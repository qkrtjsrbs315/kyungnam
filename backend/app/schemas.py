from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- 브랜드 ----------
class BrandCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class BrandOut(ORMModel):
    id: int
    name: str


# ---------- 거래처 ----------
class ClientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    contact: str | None = None
    memo: str | None = None


class ClientOut(ORMModel):
    id: int
    name: str
    contact: str | None
    memo: str | None


class ClientPriceSet(BaseModel):
    product_id: int
    unit_price: int = Field(ge=0)


class ClientPriceOut(ORMModel):
    id: int
    product_id: int
    unit_price: int


# ---------- 제품 ----------
class VariantOut(ORMModel):
    id: int
    size: str
    stock: int


class ProductCreate(BaseModel):
    category: Literal["shoe", "goods"]
    name: str = Field(min_length=1, max_length=200)
    model: str | None = None
    color: str | None = None
    work_type: Literal["light", "normal"] | None = None  # 신발 전용
    item_type: str | None = None  # 용품 전용
    image_url: str | None = None
    low_stock_threshold: int = Field(default=10, ge=0)
    brand_id: int | None = None
    initial_stocks: dict[str, int] = Field(default_factory=dict)  # {"250": 10, ...}


class ProductUpdate(BaseModel):
    name: str | None = None
    model: str | None = None
    color: str | None = None
    work_type: Literal["light", "normal"] | None = None
    item_type: str | None = None
    image_url: str | None = None
    low_stock_threshold: int | None = Field(default=None, ge=0)
    brand_id: int | None = None


class ProductOut(ORMModel):
    id: int
    category: str
    name: str
    model: str | None
    color: str | None
    work_type: str | None
    item_type: str | None
    image_url: str | None
    has_image: bool = False  # DB에 업로드 이미지 존재 여부 (GET /products/{id}/image 로 서빙)
    low_stock_threshold: int
    brand: BrandOut | None
    variants: list[VariantOut]


# ---------- 입출고 ----------
class MovementCreate(BaseModel):
    type: Literal["in", "out", "return"]
    variant_id: int
    qty: int = Field(ge=1)
    client_id: int | None = None
    unit_price: int | None = Field(default=None, ge=0)
    memo: str | None = None


class MovementOut(ORMModel):
    id: int
    type: str
    qty: int
    unit_price: int | None
    memo: str | None
    created_at: datetime
    variant: VariantOut
    client: ClientOut | None
    # 프론트 표시용 부가 정보
    product_id: int | None = None
    product_name: str | None = None
    product_model: str | None = None


# ---------- 통계 ----------
class MonthlyRow(BaseModel):
    """월별 입고/출고/반품 수량 (막대그래프용)"""

    month: str  # '2026-08'
    in_qty: int
    out_qty: int
    return_qty: int


class OutboundRow(BaseModel):
    period: str  # '2026-08-27' 또는 '2026-08'
    product_id: int
    product_name: str
    product_model: str | None
    size: str
    qty: int


class ClientSalesRow(BaseModel):
    client_id: int
    client_name: str
    out_qty: int
    return_qty: int
    sales_amount: int  # 출고액 - 반품액


class DashboardOut(BaseModel):
    total_stock: int
    product_count: int
    low_stock_count: int
    today_movements: int
