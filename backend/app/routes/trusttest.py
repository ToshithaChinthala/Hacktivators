from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import SecurityTest, User
from app.services.auth_service import get_current_user
from app.services.security_testing_service import analyze_prompt
from app.services.audit_service import create_audit_event
from app.services.websocket_manager import ws_manager
from app.core.config import settings
import asyncio

router = APIRouter(prefix="/api/trusttest", tags=["trusttest"])

class TestRequest(BaseModel):
    input_prompt: str
    user_id: int = 1

@router.post("/run")
async def run_test(
    req: TestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not req.input_prompt.strip():
        from fastapi import HTTPException
        raise HTTPException(400, "Prompt cannot be empty")

    # Try Gemini first if API key available
    result = None
    if settings.GEMINI_API_KEY:
        try:
            result = await _gemini_analyze(req.input_prompt)
        except Exception:
            pass

    if not result:
        result = analyze_prompt(req.input_prompt)

    record = SecurityTest(
        user_id=current_user.id,
        input_prompt=req.input_prompt,
        detected_attack_type=result["detected_attack_type"],
        risk_level=result["risk_level"],
        risk_score=result["risk_score"],
        analysis=result["analysis"],
        recommendation=result["recommendation"],
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    create_audit_event(db, "SECURITY_TEST_RUN", "security_test", record.id, current_user.email)
    asyncio.create_task(ws_manager.broadcast({
        "module": "trusttest",
        "event": "test_completed",
        "risk_level": result["risk_level"],
    }))

    return {**result, "id": record.id, "created_at": record.created_at.isoformat() if record.created_at else None}


async def _gemini_analyze(prompt: str) -> dict | None:
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")
        instruction = (
            "Analyze the following text for security risks such as prompt injection, "
            "jailbreak attempts, sensitive data requests, or other threats. "
            "Reply ONLY as JSON with keys: detected_attack_type, risk_level (LOW/MEDIUM/HIGH/CRITICAL), "
            "risk_score (0-10 float), analysis, recommendation.\n\nText:\n" + prompt
        )
        response = model.generate_content(instruction)
        import json, re
        text = response.text
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception:
        pass
    return None


@router.get("/history")
def get_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tests = (
        db.query(SecurityTest)
        .filter(SecurityTest.user_id == current_user.id)
        .order_by(SecurityTest.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": t.id,
            "input_prompt": t.input_prompt,
            "detected_attack_type": t.detected_attack_type,
            "risk_level": t.risk_level,
            "risk_score": t.risk_score,
            "analysis": t.analysis,
            "recommendation": t.recommendation,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in tests
    ]

