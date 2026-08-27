from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

# 카테고리: shoe(신발) / goods(용품)
# 신발 사이즈: 230~300(5 단위), 용품 사이즈: S/M/L
SHOE_SIZES = [str(s) for s in range(230, 305, 5)]
GOODS_SIZES = ["S", "M", "L"]


class Brand(Base):
    """신발 브랜드 (에어워크, 엘에이기어 등 - 추후 추가 가능)"""

    __tablename__ = "brands"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)

    products: Mapped[list["Product"]] = relationship(back_populates="brand")


class Client(Base):
    """거래처 (거래처별 단가 상이)"""

    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    contact: Mapped[str | None] = mapped_column(String(100))
    memo: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    prices: Mapped[list["ClientPrice"]] = relationship(back_populates="client", cascade="all, delete-orphan")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str] = mapped_column(String(10))  # 'shoe' | 'goods'
    name: Mapped[str] = mapped_column(String(200))  # 제품명
    model: Mapped[str | None] = mapped_column(String(100))  # 모델명 (예: AW-600D)
    color: Mapped[str | None] = mapped_column(String(50))
    work_type: Mapped[str | None] = mapped_column(String(10))  # 신발: 'light'(경작업용) | 'normal'(보통작업용)
    item_type: Mapped[str | None] = mapped_column(String(50))  # 용품: 옷, 스카프 등
    image_url: Mapped[str | None] = mapped_column(Text)
    # 업로드 이미지는 DB(Neon)에 직접 저장한다. 목록 조회 시 blob 을 안 읽도록 deferred.
    image_data: Mapped[bytes | None] = mapped_column(LargeBinary, deferred=True)
    image_mime: Mapped[str | None] = mapped_column(String(50))
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=10)
    brand_id: Mapped[int | None] = mapped_column(ForeignKey("brands.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    brand: Mapped[Brand | None] = relationship(back_populates="products")

    @property
    def has_image(self) -> bool:
        return self.image_mime is not None
    variants: Mapped[list["Variant"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", order_by="Variant.id"
    )
    prices: Mapped[list["ClientPrice"]] = relationship(back_populates="product", cascade="all, delete-orphan")


class Variant(Base):
    """제품의 사이즈별 재고"""

    __tablename__ = "variants"
    __table_args__ = (UniqueConstraint("product_id", "size", name="uq_variant_product_size"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    size: Mapped[str] = mapped_column(String(10))
    stock: Mapped[int] = mapped_column(Integer, default=0)

    product: Mapped[Product] = relationship(back_populates="variants")
    # 제품(사이즈) 삭제 시 입출고 기록도 함께 삭제
    movements: Mapped[list["Movement"]] = relationship(
        back_populates="variant", cascade="all, delete-orphan"
    )


class ClientPrice(Base):
    """거래처별 제품 단가"""

    __tablename__ = "client_prices"
    __table_args__ = (UniqueConstraint("client_id", "product_id", name="uq_price_client_product"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    unit_price: Mapped[int] = mapped_column(Integer)  # 원 단위

    client: Mapped[Client] = relationship(back_populates="prices")
    product: Mapped[Product] = relationship(back_populates="prices")


class DeviceToken(Base):
    """FCM 푸시 알림 기기 토큰"""

    __tablename__ = "device_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    token: Mapped[str] = mapped_column(String(512), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Movement(Base):
    """입고 / 출고 / 반품 내역"""

    __tablename__ = "movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(String(10))  # 'in' | 'out' | 'return'
    variant_id: Mapped[int] = mapped_column(ForeignKey("variants.id", ondelete="CASCADE"))
    qty: Mapped[int] = mapped_column(Integer)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id", ondelete="SET NULL"))
    unit_price: Mapped[int | None] = mapped_column(Integer)  # 출고/반품 시 적용 단가
    memo: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    variant: Mapped[Variant] = relationship(back_populates="movements")
    client: Mapped[Client | None] = relationship()
