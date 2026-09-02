from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import ClientPrice, Movement, Variant
from ..notify import send_low_stock_alert
from ..schemas import MovementCreate, MovementOut, MovementUpdate

router = APIRouter(prefix="/movements", tags=["movements"])


def _effect(move_type: str) -> int:
    """재고에 미치는 부호: 입고/반품 = +1, 출고 = -1"""
    return -1 if move_type == "out" else 1


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


@router.patch("/{movement_id}", response_model=MovementOut)
def update_movement(movement_id: int, body: MovementUpdate, db: Session = Depends(get_db)):
    """내역 수정 - 기존 재고 반영분을 되돌린 뒤 수정된 내용으로 다시 반영한다."""
    movement = db.scalar(
        select(Movement)
        .options(selectinload(Movement.variant).selectinload(Variant.product))
        .where(Movement.id == movement_id)
    )
    if not movement:
        raise HTTPException(404, "내역을 찾을 수 없습니다.")

    data = body.model_dump(exclude_unset=True)
    new_type = data.get("type", movement.type)
    new_qty = data.get("qty", movement.qty)
    new_variant_id = data.get("variant_id", movement.variant_id)

    new_variant = movement.variant
    if new_variant_id != movement.variant_id:
        new_variant = db.scalar(
            select(Variant).options(selectinload(Variant.product)).where(Variant.id == new_variant_id)
        )
        if not new_variant:
            raise HTTPException(404, "해당 사이즈를 찾을 수 없습니다.")

    # 기존 반영분 되돌리기 → 새 내용 반영. 먼저 계산·검증 후 적용한다.
    old_variant = movement.variant
    reverted_old = old_variant.stock - _effect(movement.type) * movement.qty
    if new_variant is old_variant:
        checks = [(old_variant, reverted_old + _effect(new_type) * new_qty)]
    else:
        checks = [
            (old_variant, reverted_old),
            (new_variant, new_variant.stock + _effect(new_type) * new_qty),
        ]
    for v, prospective in checks:
        if prospective < 0:
            raise HTTPException(
                400,
                f"수정하면 {v.product.name} {v.size} 재고가 음수({prospective}개)가 됩니다. 수량을 확인해주세요.",
            )
    for v, prospective in checks:
        v.stock = prospective

    movement.type = new_type
    movement.qty = new_qty
    movement.variant_id = new_variant.id
    if "client_id" in data:
        movement.client_id = data["client_id"]
    if "unit_price" in data:
        movement.unit_price = data["unit_price"]
    if "memo" in data:
        movement.memo = data["memo"]
    db.commit()
    db.expire_all()  # variant 관계가 바뀌었을 수 있으므로 캐시를 비우고 다시 읽는다

    m = db.scalar(
        select(Movement)
        .options(
            selectinload(Movement.variant).selectinload(Variant.product),
            selectinload(Movement.client),
        )
        .where(Movement.id == movement_id)
    )
    return _to_out(m)


@router.delete("/{movement_id}", status_code=204)
def delete_movement(movement_id: int, db: Session = Depends(get_db)):
    """내역 삭제 - 재고를 처리 전 상태로 되돌린다."""
    movement = db.scalar(
        select(Movement)
        .options(selectinload(Movement.variant).selectinload(Variant.product))
        .where(Movement.id == movement_id)
    )
    if not movement:
        raise HTTPException(404, "내역을 찾을 수 없습니다.")
    variant = movement.variant
    restored = variant.stock - _effect(movement.type) * movement.qty
    if restored < 0:
        raise HTTPException(
            400,
            f"삭제하면 {variant.product.name} {variant.size} 재고가 음수({restored}개)가 됩니다. "
            "이후 출고 내역을 먼저 정리해주세요.",
        )
    variant.stock = restored
    db.delete(movement)
    db.commit()
