"""
Authentication and Token Management Service.
Provides bcrypt password hashing, JWT token generation, token revocation checking,
and the get_current_user dependency for authenticated endpoints.
"""

import uuid
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User, RevokedToken
from app.core.config import settings

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


def hash_password(password: str) -> str:
    """Hash password using bcrypt with 12 salt rounds."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify plain password against hashed password.
    Supports bcrypt ($2b$, $2a$) and legacy SHA-256 hashes seamlessly.
    """
    if not hashed_password or not plain_password:
        return False

    # Standard bcrypt hash
    if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$"):
        try:
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
        except Exception:
            return False

    # Legacy SHA-256 fallback (e.g. initial demo admin seed)
    if len(hashed_password) == 64:
        sha_hash = hashlib.sha256(plain_password.encode("utf-8")).hexdigest()
        return sha_hash.lower() == hashed_password.lower()

    return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> Tuple[str, str]:
    """
    Generate signed JWT access token.
    Returns (token_string, jti).
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(hours=JWT_EXPIRATION_HOURS))
    token_jti = str(uuid.uuid4())

    to_encode.update({
        "jti": token_jti,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    })

    token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token, token_jti


def revoke_token(db: Session, jti: str) -> None:
    """Record token JTI into revoked_tokens table."""
    if not jti:
        return
    existing = db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
    if not existing:
        revoked = RevokedToken(jti=jti)
        db.add(revoked)
        db.commit()


def is_token_revoked(db: Session, jti: str) -> bool:
    """Check if token JTI is in revoked_tokens table."""
    if not jti:
        return True
    return db.query(RevokedToken).filter(RevokedToken.jti == jti).first() is not None


def decode_token(token: str) -> dict:
    """Decode and validate JWT signature and expiration."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency that extracts and validates the JWT Bearer token,
    checks for token revocation, and returns the authenticated User instance.
    Never trusts client-supplied actor strings or IDs.
    """
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth.credentials
    payload = decode_token(token)

    jti = payload.get("jti")
    if is_token_revoked(db, jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been terminated. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing user ID.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
