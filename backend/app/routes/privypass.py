from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import PrivacyCredential
from app.services.privacy_service import verify_credential
from app.services.audit_service import create_audit_event
from app.services.websocket_manager import ws_manager
import asyncio

router = APIRouter(prefix="/api/privypass", tags=["privypass"])

class CredentialRequest(BaseModel):
    credential_type: str
    issuer: str = "Demo CA"
    claim_value: str
    threshold: str
    user_id: int = 1

@router.post("/verify")
async def verify_privypass(req: CredentialRequest, db: Session = Depends(get_db)):
    result = verify_credential(
        credential_type=req.credential_type,
        claim_value=req.claim_value,
        threshold=req.threshold,
        issuer=req.issuer,
    )

    record = PrivacyCredential(
        user_id=req.user_id,
        credential_type=req.credential_type,
        issuer=req.issuer,
        verification_status=result["verification_status"],
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    create_audit_event(db, "PRIVACY_VERIFIED", "privacy_credential", record.id, f"user_{req.user_id}")
    asyncio.create_task(ws_manager.broadcast({"module": "privypass", "event": "credential_verified", "status": result["verification_status"]}))

    return result

@router.get("/history")
def get_history(db: Session = Depends(get_db)):
    records = db.query(PrivacyCredential).order_by(PrivacyCredential.created_at.desc()).limit(50).all()
    return [
        {
            "id": r.id,
            "credential_type": r.credential_type,
            "issuer": r.issuer,
            "verification_status": r.verification_status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]

