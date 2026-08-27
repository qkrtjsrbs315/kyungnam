from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Brand
from ..schemas import BrandCreate, BrandOut

router = APIRouter(prefix="/brands", tags=["brands"])


@router.get("", response_model=list[BrandOut])
def list_brands(db: Session = Depends(get_db)):
    return db.scalars(select(Brand).order_by(Brand.name)).all()


@router.post("", response_model=BrandOut, status_code=201)
def create_brand(body: BrandCreate, db: Session = Depends(get_db)):
    if db.scalar(select(Brand).where(Brand.name == body.name)):
        raise HTTPException(409, "이미 존재하는 브랜드입니다.")
    brand = Brand(name=body.name)
    db.add(brand)
    db.commit()
    db.refresh(brand)
    return brand
