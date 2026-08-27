from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import GOODS_SIZES, SHOE_SIZES, Product, Variant
from ..schemas import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


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
