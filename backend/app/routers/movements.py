from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import ClientPrice, Movement, Variant
from ..notify import send_low_stock_alert
from ..schemas import MovementCreate, MovementOut

router = APIRouter(prefix="/movements", tags=["movements"])


def _to_out(m: Movement) -> MovementOut:
    out = MovementOut.model_validate(m)
    product = m.variant.product
    out.product_id = product.id
    out.product_name = product.name
    out.product_model = product.model
    return out


@router.get("", response_model=list[MovementOut])
def list_movements(limit: int = 200, db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Movement)
        .options(
            selectinload(Movement.variant).selectinload(Variant.product),
            selectinload(Movement.client),
        )
        .order_by(Movement.created_at.desc(), Movement.id.desc())
        .limit(min(limit, 1000))
    ).all()
    return [_to_out(m) for m in rows]


@router.post("", response_model=MovementOut, status_code=201)
def create_movement(body: MovementCreate, db: Session = Depends(get_db)):
    variant = db.scalar(
        select(Variant).options(selectinload(Variant.product)).where(Variant.id == body.variant_id)
    )
    if not variant:
        raise HTTPException(404, "해당 사이즈를 찾을 수 없습니다.")

    # 재고 반영: 입고/반품 = 증가, 출고 = 감소
    if body.type == "out":
        if body.qty > variant.stock:
            raise HTTPException(400, f"현재 재고는 {variant.stock}개입니다. 출고 수량을 확인해주세요.")
        variant.stock -= body.qty
    else:
        variant.stock += body.qty

    # 단가 미입력 시 거래처별 단가 자동 적용
    unit_price = body.unit_price
    if unit_price is None and body.client_id:
        cp = db.scalar(
            select(ClientPrice).where(
                ClientPrice.client_id == body.client_id,
                ClientPrice.product_id == variant.product_id,
            )
        )
        if cp:
            unit_price = cp.unit_price

    movement = Movement(
        type=body.type,
        variant_id=variant.id,
        qty=body.qty,
        client_id=body.client_id,
        unit_price=unit_price,
        memo=body.memo,
    )
    db.add(movement)
    db.commit()

    # 출고 후 재고 부족 시 알림 (서버리스에서도 유실되지 않도록 동기 전송)
    product = variant.product
    if body.type == "out" and variant.stock <= product.low_stock_threshold:
        label = f"{product.model or ''} {product.name}".strip()
        send_low_stock_alert(label, variant.size, variant.stock, product.low_stock_threshold)

    m = db.scalar(
        select(Movement)
        .options(
            selectinload(Movement.variant).selectinload(Variant.product),
            selectinload(Movement.client),
        )
        .where(Movement.id == movement.id)
    )
    return _to_out(m)
