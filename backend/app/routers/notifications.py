from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import DeviceToken
from ..notify import get_firebase, send_fcm

router = APIRouter(prefix="/notifications", tags=["notifications"])


class TokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=512)


class StatusOut(BaseModel):
    fcm_configured: bool
    ntfy_configured: bool
    token_count: int


@router.get("/status", response_model=StatusOut)
def status(db: Session = Depends(get_db)):
    return StatusOut(
        fcm_configured=get_firebase() is not None,
        ntfy_configured=bool(settings.ntfy_topic),
        token_count=db.scalar(select(func.count(DeviceToken.id))) or 0,
    )


@router.post("/tokens", status_code=201)
def register_token(body: TokenIn, db: Session = Depends(get_db)):
    """프론트에서 발급받은 FCM 기기 토큰 등록 (중복이면 무시)."""
    existing = db.scalar(select(DeviceToken).where(DeviceToken.token == body.token))
    if not existing:
        db.add(DeviceToken(token=body.token))
        db.commit()
    return {"ok": True}


@router.post("/test")
def send_test(db: Session = Depends(get_db)):
    """등록된 모든 기기로 테스트 푸시 발송."""
    sent = send_fcm("테스트 알림", "경남산업 재고관리 푸시 알림이 정상 동작합니다.")
    return {"sent": sent}
