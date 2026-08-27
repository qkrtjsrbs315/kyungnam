from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload, undefer

from ..database import get_db
from ..models import GOODS_SIZES, SHOE_SIZES, Product, Variant
from ..schemas import ProductCreate, ProductOut, ProductUpdate

MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5MB (프론트에서 리사이즈 후 업로드)

router = APIRouter(prefix="/products", tags=["products"])
# 이미지 조회는 <img src> 로 불러서 Authorization 헤더를 못 붙이므로 인증 없이 공개
image_router = APIRouter(prefix="/products", tags=["products"])


def _product_query():
    return select(Product).options(
        selectinload(Product.variants), selectinload(Product.brand)
    )


@router.get("", response_model=list[ProductOut])
def list_products(category: str | None = None, db: Session = Depends(get_db)):
    q = _product_query().order_by(Product.created_at.desc())
    if category:
        q = q.where(Product.category == category)
    return db.scalars(q).all()


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.scalar(_product_query().where(Product.id == product_id))
    if not product:
        raise HTTPException(404, "제품을 찾을 수 없습니다.")
    return product


@router.post("", response_model=ProductOut, status_code=201)
def create_product(body: ProductCreate, db: Session = Depends(get_db)):
    sizes = SHOE_SIZES if body.category == "shoe" else GOODS_SIZES
    product = Product(
        category=body.category,
        name=body.name,
        model=body.model,
        color=body.color,
        work_type=body.work_type if body.category == "shoe" else None,
        item_type=body.item_type if body.category == "goods" else None,
        image_url=body.image_url,
        low_stock_threshold=body.low_stock_threshold,
        brand_id=body.brand_id if body.category == "shoe" else None,
    )
    # 카테고리에 맞는 사이즈 변형을 전부 만들어 둔다 (초기 재고 반영)
    for size in sizes:
        product.variants.append(Variant(size=size, stock=max(0, int(body.initial_stocks.get(size, 0)))))
    db.add(product)
    db.commit()
    return db.scalar(_product_query().where(Product.id == product.id))


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, body: ProductUpdate, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "제품을 찾을 수 없습니다.")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    return db.scalar(_product_query().where(Product.id == product_id))


@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "제품을 찾을 수 없습니다.")
    db.delete(product)
    db.commit()


@router.post("/{product_id}/image", response_model=ProductOut)
async def upload_image(product_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """제품 이미지 업로드 - DB(Neon)에 바이너리로 저장한다."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "제품을 찾을 수 없습니다.")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "이미지 파일만 업로드할 수 있습니다.")
    data = await file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(400, "이미지는 5MB 이하만 업로드할 수 있습니다.")
    product.image_data = data
    product.image_mime = file.content_type
    db.commit()
    return db.scalar(_product_query().where(Product.id == product_id))


@image_router.get("/{product_id}/image")
def get_image(product_id: int, db: Session = Depends(get_db)):
    product = db.scalar(
        select(Product).options(undefer(Product.image_data)).where(Product.id == product_id)
    )
    if not product or not product.image_data:
        raise HTTPException(404, "이미지가 없습니다.")
    return Response(
        content=product.image_data,
        media_type=product.image_mime or "image/jpeg",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.delete("/{product_id}/image", status_code=204)
def delete_image(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "제품을 찾을 수 없습니다.")
    product.image_data = None
    product.image_mime = None
    db.commit()
