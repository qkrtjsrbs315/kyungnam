import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .config import settings
from .database import Base, SessionLocal, engine
from .models import Brand
from .routers import brands, clients, movements, notifications, products, stats

logger = logging.getLogger(__name__)

DEFAULT_BRANDS = ["에어워크", "엘에이기어"]


def init_db() -> None:
    """테이블 생성 + 기본 브랜드 시드. 서버리스(Vercel) 콜드 스타트에서도 동작하도록
    lifespan 이 아닌 import 시점에 호출한다. DB 미연결 시에도 앱은 뜨게 한다."""
    try:
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            existing = set(db.scalars(select(Brand.name)).all())
            for name in DEFAULT_BRANDS:
                if name not in existing:
                    db.add(Brand(name=name))
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

app.include_router(brands.router)
app.include_router(products.router)
app.include_router(movements.router)
app.include_router(clients.router)
app.include_router(stats.router)
app.include_router(notifications.router)


@app.get("/")
def health():
    return {"status": "ok", "service": "kyungnam-inventory"}
