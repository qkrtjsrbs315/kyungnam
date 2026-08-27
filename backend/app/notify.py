"""재고 부족 알림 - 무료 채널 위주.

1) ntfy.sh 푸시: 서버에서 토픽으로 POST만 하면 핸드폰 ntfy 앱(무료)에서 즉시 푸시 수신.
   가입/키 발급 불필요. .env 의 NTFY_TOPIC 만 설정하면 동작한다.
2) 이메일(SMTP): Gmail 앱 비밀번호 등으로 무료 발송 가능. SMTP_* 설정 시 동작.
둘 다 미설정이면 조용히 건너뛴다(앱 동작에는 영향 없음).
"""

import logging
import smtplib
from email.mime.text import MIMEText

import httpx

from .config import settings

logger = logging.getLogger(__name__)


def send_low_stock_alert(product_label: str, size: str, stock: int, threshold: int) -> None:
    title = "재고 부족 알림"
    body = f"{product_label} {size} 재고가 {stock}개 남았습니다. (기준 {threshold}개 이하)"

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
