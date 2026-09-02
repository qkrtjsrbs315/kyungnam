import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, select, text

from .auth import hash_password, require_auth
from .config import settings
from .database import Base, SessionLocal, engine
from .models import Brand, User
from .routers import auth, brands, clients, movements, notifications, products, stats

logger = logging.getLogger(__name__)

DEFAULT_BRANDS = ["에어워크", "엘에이기어"]


# create_all 은 기존 테이블에 컬럼을 추가하지 않으므로, 새로 생긴 컬럼은 여기서 보정한다.
_COLUMN_MIGRATIONS = [
    ("products", "base_price", "INTEGER"),
    ("products", "memo", "TEXT"),
]


def _ensure_columns() -> None:
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    with engine.begin() as conn:
        for table, column, ddl_type in _COLUMN_MIGRATIONS:
            if table in tables:
                existing = {c["name"] for c in insp.get_columns(table)}
                if column not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))
                    logger.info("컬럼 추가: %s.%s", table, column)


def init_db() -> None:
    """테이블 생성 + 기본 브랜드/관리자 계정 시드. 서버리스(Vercel) 콜드 스타트에서도
    동작하도록 lifespan 이 아닌 import 시점에 호출한다. DB 미연결 시에도 앱은 뜨게 한다."""
    try:
        Base.metadata.create_all(bind=engine)
        _ensure_columns()
        with SessionLocal() as db:
            existing = set(db.scalars(select(Brand.name)).all())
            for name in DEFAULT_BRANDS:
                if name not in existing:
                    db.add(Brand(name=name))
            # 사용자가 하나도 없으면 admin 계정 생성 (초기 비밀번호는 로그인 후 변경 권장)
            if not db.scalar(select(User.id).limit(1)):
                db.add(User(username="admin", password_hash=hash_password(settings.admin_initial_password)))
            db.commit()
    except Exception:
        logger.exception("DB 초기화 실패 - DATABASE_URL 을 확인해주세요.")


init_db()

app = FastAPI(title="경남산업 재고관리 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.frontend_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 공개: 로그인, 제품 이미지(<img> 태그용)
app.include_router(auth.router)
app.include_router(products.image_router)

# 보호: 로그인 필수
protected = [Depends(require_auth)]
app.include_router(brands.router, dependencies=protected)
app.include_router(products.router, dependencies=protected)
app.include_router(movements.router, dependencies=protected)
app.include_router(clients.router, dependencies=protected)
app.include_router(stats.router, dependencies=protected)
app.include_router(notifications.router, dependencies=protected)


@app.get("/")
def health():
    return {"status": "ok", "service": "kyungnam-inventory"}
