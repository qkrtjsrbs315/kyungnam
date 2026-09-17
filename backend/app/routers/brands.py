from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..brand_names import brand_name
from ..models import Brand
from ..schemas import BrandCreate, BrandOut

router = APIRouter(prefix="/brands", tags=["brands"])


@router.get("", response_model=list[BrandOut])
def list_brands(db: Session = Depends(get_db)):
    return db.scalars(select(Brand).order_by(Brand.name)).all()


@router.post("", response_model=BrandOut, status_code=201)
def create_brand(body: BrandCreate, db: Session = Depends(get_db)):
    name = brand_name(body.name)
    if not name:
        raise HTTPException(422, "브랜드명을 입력해주세요.")
    if any(brand_name(n) == name for n in db.scalars(select(Brand.name))):
        raise HTTPException(409, "이미 존재하는 브랜드입니다.")
    brand = Brand(name=name)
    db.add(brand)
    db.commit()
    db.refresh(brand)
    return brand
