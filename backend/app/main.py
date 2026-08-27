from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .config import settings
from .database import Base, SessionLocal, engine
from .models import Brand
from .routers import brands, clients, movements, notifications, products, stats

DEFAULT_BRANDS = ["에어워크", "엘에이기어"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # 기본 브랜드 시드
    with SessionLocal() as db:
        existing = set(db.scalars(select(Brand.name)).all())
        for name in DEFAULT_BRANDS:
            if name not in existing:
                db.add(Brand(name=name))
        db.commit()
    yield


app = FastAPI(title="경남산업 재고관리 API", lifespan=lifespan)

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
