from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """환경 설정. backend/.env 파일에서 로드된다."""

    # Neon PostgreSQL 연결 문자열 (예: postgresql+psycopg://user:pw@host/db?sslmode=require)
    # 미설정 시 로컬 SQLite로 동작해 DB 없이도 개발할 수 있다.
    database_url: str = "sqlite:///./dev.db"

    # CORS 허용 프론트엔드 주소 (쉼표 구분)
    frontend_origins: str = "http://localhost:3000"

    # 로그인 토큰(JWT) 서명 키 - 배포 시 반드시 긴 무작위 문자열로 교체
    secret_key: str = "kyungnam-dev-secret-change-me"
    # 최초 생성되는 admin 계정 비밀번호 (users 테이블이 비어있을 때 1회만 사용)
    admin_initial_password: str = "kyungnam1234"

    # 재고 부족 알림 - Firebase Cloud Messaging (FCM)
    # Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성 → json 파일 경로
    firebase_credentials: str = ""
    # 파일을 둘 수 없는 서버리스(Vercel) 환경용: json 내용 전체를 환경변수로
    firebase_credentials_json: str = ""

    # 재고 부족 알림 - ntfy.sh 무료 푸시 (토픽명만 정하면 앱에서 구독 가능)
    ntfy_topic: str = ""

    # 재고 부족 알림 - 이메일(SMTP). Gmail 앱 비밀번호 사용 가능
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    alert_email_to: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
