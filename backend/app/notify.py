"""재고 부족 알림.

1) Firebase Cloud Messaging(FCM) 푸시: 프론트에서 알림을 켠 기기(등록된 토큰)로 발송.
   .env 의 FIREBASE_CREDENTIALS 에 서비스 계정 json 경로를 설정하면 동작한다.
2) ntfy.sh 푸시: 서버에서 토픽으로 POST만 하면 핸드폰 ntfy 앱(무료)에서 즉시 푸시 수신.
   가입/키 발급 불필요. .env 의 NTFY_TOPIC 만 설정하면 동작한다.
3) 이메일(SMTP): Gmail 앱 비밀번호 등으로 무료 발송 가능. SMTP_* 설정 시 동작.
모두 미설정이면 조용히 건너뛴다(앱 동작에는 영향 없음).
"""

import logging
import smtplib
from email.mime.text import MIMEText

import httpx
from sqlalchemy import delete, select

from .config import settings

logger = logging.getLogger(__name__)

_firebase_app = None


def get_firebase():
    """FIREBASE_CREDENTIALS(_JSON) 가 설정된 경우에만 firebase_admin 초기화 (1회)."""
    global _firebase_app
    if _firebase_app is None and (settings.firebase_credentials or settings.firebase_credentials_json):
        try:
            import json

            import firebase_admin
            from firebase_admin import credentials

            if settings.firebase_credentials_json:
                cred = credentials.Certificate(json.loads(settings.firebase_credentials_json))
            else:
                cred = credentials.Certificate(settings.firebase_credentials)
            _firebase_app = firebase_admin.initialize_app(cred)
        except Exception:
            logger.exception("Firebase 초기화 실패 - FIREBASE_CREDENTIALS(_JSON) 설정을 확인해주세요.")
    return _firebase_app


def send_fcm(title: str, body: str) -> int:
    """등록된 모든 기기 토큰으로 FCM 푸시 발송. 발송 성공 수를 반환한다."""
    app = get_firebase()
    if not app:
        return 0
    from firebase_admin import messaging

    from .database import SessionLocal
    from .models import DeviceToken

    with SessionLocal() as db:
        tokens = list(db.scalars(select(DeviceToken.token)).all())
        if not tokens:
            return 0
        message = messaging.MulticastMessage(
            tokens=tokens,
            notification=messaging.Notification(title=title, body=body),
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(title=title, body=body),
                fcm_options=messaging.WebpushFCMOptions(link="/"),
            ),
        )
        try:
            resp = messaging.send_each_for_multicast(message, app=app)
        except Exception:
            logger.exception("FCM 발송 실패")
            return 0
        # 앱 삭제 등으로 무효해진 토큰은 정리한다
        stale = [
            t
            for r, t in zip(resp.responses, tokens)
            if not r.success and isinstance(r.exception, messaging.UnregisteredError)
        ]
        if stale:
            db.execute(delete(DeviceToken).where(DeviceToken.token.in_(stale)))
            db.commit()
        return resp.success_count


def send_low_stock_alert(product_label: str, size: str, stock: int, threshold: int) -> None:
    title = "재고 부족 알림"
    body = f"{product_label} {size} 재고가 {stock}개 남았습니다. (기준 {threshold}개 이하)"

    try:
        send_fcm(title, body)
    except Exception:
        logger.exception("FCM 알림 전송 실패")

    if settings.ntfy_topic:
        try:
            httpx.post(
                f"https://ntfy.sh/{settings.ntfy_topic}",
                content=body.encode("utf-8"),
                headers={
                    "Title": title.encode("utf-8").decode("latin-1", errors="replace"),
                    "Priority": "high",
                    "Tags": "warning",
                },
                timeout=10,
            )
        except Exception:
            logger.exception("ntfy 알림 전송 실패")

    if settings.smtp_host and settings.alert_email_to:
        try:
            msg = MIMEText(body, _charset="utf-8")
            msg["Subject"] = title
            msg["From"] = settings.smtp_user
            msg["To"] = settings.alert_email_to
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
                server.starttls()
                if settings.smtp_user:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        except Exception:
            logger.exception("이메일 알림 전송 실패")
