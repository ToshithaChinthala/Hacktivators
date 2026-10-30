"""
Authentication API routes.
Provides user registration, login with bcrypt verification,
server-side token revocation (logout), and profile retrieval.
"""

import re
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from fastapi.security import HTTPAuthorizationCredentials

from app.database import get_db
from app.models.models import User
from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    revoke_token,
    decode_token,
    get_current_user,
    security,
)
from app.services.audit_service import create_audit_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new user account.
    Enforces email validation, minimum password strength, and unique emails.
    Stores password hashed using bcrypt.
    """
    email_clean = req.email.strip().lower()
    if not email_clean or not EMAIL_REGEX.match(email_clean):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format. Please provide a valid email address.",
        )

    if not req.password or len(req.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters in length.",
        )

    # Check for existing user
    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    # Hash password with bcrypt
    hashed_pw = hash_password(req.password)
    default_name = email_clean.split("@")[0].replace(".", " ").title()

    new_user = User(
        email=email_clean,
        password_hash=hashed_pw,
        name=default_name,
        role="user",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Audit registration
    try:
        create_audit_event(db, "USER_REGISTERED", "user", new_user.id, new_user.email)
    except Exception as e:
        logger.warning(f"Audit event for registration failed: {e}")

    token, _ = create_access_token({
        "user_id": new_user.id,
        "email": new_user.email,
        "role": new_user.role,
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "role": new_user.role,
            "name": new_user.name,
        },
        "message": "Registration successful.",
    }


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user with email and password.
    Validates bcrypt hash (with seamless migration for legacy seed hashes).
    Returns JWT access token.
    """
    email_clean = req.email.strip().lower()
    if not email_clean or not req.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide both email and password.",
        )

    user = db.query(User).filter(User.email == email_clean).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Automatically upgrade legacy SHA-256 hash to bcrypt on successful login
    if user.password_hash and len(user.password_hash) == 64:
        user.password_hash = hash_password(req.password)
        db.commit()

    token, _ = create_access_token({
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
    })

    try:
        create_audit_event(db, "USER_LOGIN", "user", user.id, user.email)
    except Exception as e:
        logger.warning(f"Audit event for login failed: {e}")

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "name": user.name,
        },
        "message": "Login successful.",
    }


@router.post("/logout")
def logout(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
):
    """
    Terminate session and revoke the current JWT token on the backend.
    """
    if auth and auth.credentials:
        try:
            payload = decode_token(auth.credentials)
            jti = payload.get("jti")
            if jti:
                revoke_token(db, jti)
        except Exception:
            pass

    return {"message": "Logged out successfully. Session terminated."}


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Return profile of currently authenticated user."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "name": current_user.name,
    }
