from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Client, ClientPrice
from ..schemas import ClientCreate, ClientOut, ClientPriceOut, ClientPriceSet, ClientUpdate

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("", response_model=list[ClientOut])
def list_clients(db: Session = Depends(get_db)):
    return db.scalars(select(Client).order_by(Client.name)).all()


@router.post("", response_model=ClientOut, status_code=201)
def create_client(body: ClientCreate, db: Session = Depends(get_db)):
    if db.scalar(select(Client).where(Client.name == body.name)):
        raise HTTPException(409, "이미 존재하는 거래처입니다.")
    client = Client(**body.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.patch("/{client_id}", response_model=ClientOut)
def update_client(client_id: int, body: ClientUpdate, db: Session = Depends(get_db)):
    client = db.get(Client, client_id)
    if not client:
        raise HTTPException(404, "거래처를 찾을 수 없습니다.")
    data = body.model_dump(exclude_unset=True)
    new_name = data.get("name")
    if new_name and new_name != client.name:
        if db.scalar(select(Client).where(Client.name == new_name, Client.id != client_id)):
            raise HTTPException(409, "이미 존재하는 거래처명입니다.")
    for field, value in data.items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=204)
def delete_client(client_id: int, db: Session = Depends(get_db)):
    client = db.get(Client, client_id)
    if not client:
        raise HTTPException(404, "거래처를 찾을 수 없습니다.")
    db.delete(client)
    db.commit()


@router.get("/{client_id}/prices", response_model=list[ClientPriceOut])
def list_prices(client_id: int, db: Session = Depends(get_db)):
    return db.scalars(select(ClientPrice).where(ClientPrice.client_id == client_id)).all()


@router.put("/{client_id}/prices", response_model=ClientPriceOut)
def set_price(client_id: int, body: ClientPriceSet, db: Session = Depends(get_db)):
    """거래처별 제품 단가 등록/수정 (upsert)"""
    if not db.get(Client, client_id):
        raise HTTPException(404, "거래처를 찾을 수 없습니다.")
    cp = db.scalar(
        select(ClientPrice).where(
            ClientPrice.client_id == client_id, ClientPrice.product_id == body.product_id
        )
    )
    if cp:
        cp.unit_price = body.unit_price
    else:
        cp = ClientPrice(client_id=client_id, product_id=body.product_id, unit_price=body.unit_price)
        db.add(cp)
    db.commit()
    db.refresh(cp)
    return cp
