from datetime import date, datetime, time, timedelta
from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Client, Movement, Product, Variant
from ..schemas import ClientSalesRow, DashboardOut, MonthlyRow, OutboundRow, SalesRow

router = APIRouter(prefix="/stats", tags=["stats"])


def _period_expr(db: Session, unit: Literal["daily", "weekly", "monthly"]):
    """KST(한국시간) 기준 기간 문자열 표현식."""
    if db.get_bind().dialect.name == "sqlite":
        fmt = {"daily": "%Y-%m-%d", "weekly": "%Y-W%W", "monthly": "%Y-%m"}[unit]
        return func.strftime(fmt, Movement.created_at, "+9 hours")
    kst = func.timezone("Asia/Seoul", Movement.created_at)
    fmt = {"daily": "YYYY-MM-DD", "weekly": 'IYYY"-W"IW', "monthly": "YYYY-MM"}[unit]
    return func.to_char(kst, fmt)


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(db: Session = Depends(get_db)):
    total_stock = db.scalar(select(func.coalesce(func.sum(Variant.stock), 0))) or 0
    product_count = db.scalar(select(func.count(Product.id))) or 0
    low_stock_count = (
        db.scalar(
            select(func.count(Variant.id))
            .join(Product, Variant.product_id == Product.id)
            .where(Variant.stock <= Product.low_stock_threshold)
        )
        or 0
    )
    today_start = datetime.combine(date.today(), time.min)
    today_movements = (
        db.scalar(select(func.count(Movement.id)).where(Movement.created_at >= today_start)) or 0
    )
    return DashboardOut(
        total_stock=total_stock,
        product_count=product_count,
        low_stock_count=low_stock_count,
        today_movements=today_movements,
    )


@router.get("/monthly", response_model=list[MonthlyRow])
def monthly(months: int = 12, db: Session = Depends(get_db)):
    """월별 입고/출고/반품 총수량 (세로 막대그래프용, 최근 N개월)"""
    since = datetime.combine(date.today().replace(day=1) - timedelta(days=31 * (months - 1)), time.min)
    since = since.replace(day=1)

    month_expr = _period_expr(db, "monthly")

    rows = db.execute(
        select(
            month_expr.label("month"),
            func.coalesce(func.sum(case((Movement.type == "in", Movement.qty), else_=0)), 0),
            func.coalesce(func.sum(case((Movement.type == "out", Movement.qty), else_=0)), 0),
            func.coalesce(func.sum(case((Movement.type == "return", Movement.qty), else_=0)), 0),
        )
        .where(Movement.created_at >= since)
        .group_by("month")
        .order_by(month_expr)
    ).all()
    return [MonthlyRow(month=r[0], in_qty=r[1], out_qty=r[2], return_qty=r[3]) for r in rows]


@router.get("/outbound", response_model=list[OutboundRow])
def outbound(
    period: Literal["daily", "monthly"] = "daily",
    days: int = 30,
    db: Session = Depends(get_db),
):
    """일별/월별 품목·사이즈별 출고 수량"""
    since = datetime.combine(date.today() - timedelta(days=days if period == "daily" else 365), time.min)
    period_expr = _period_expr(db, period)

    rows = db.execute(
        select(
            period_expr.label("period"),
            Product.id,
            Product.name,
            Product.model,
            Variant.size,
            func.sum(Movement.qty).label("qty"),
        )
        .join(Variant, Movement.variant_id == Variant.id)
        .join(Product, Variant.product_id == Product.id)
        .where(Movement.type == "out", Movement.created_at >= since)
        .group_by("period", Product.id, Product.name, Product.model, Variant.size)
        .order_by(period_expr.desc(), Product.name, Variant.size)
    ).all()
    return [
        OutboundRow(
            period=r[0], product_id=r[1], product_name=r[2], product_model=r[3], size=r[4], qty=r[5]
        )
        for r in rows
    ]


@router.get("/sales", response_model=list[SalesRow])
def sales(
    period: Literal["daily", "weekly", "monthly"] = "daily",
    dim: Literal["product", "size", "color"] = "product",
    days: int = 30,
    db: Session = Depends(get_db),
):
    """매출 현황: 기간(일/주/월) × 분류(품목/사이즈/색상)별 판매수량·매출액.
    매출액은 단가가 기록된 출고/반품 건만 합산된다."""
    since = datetime.combine(date.today() - timedelta(days=min(days, 1100)), time.min)
    p = _period_expr(db, period)
    if dim == "product":
        key = func.coalesce(Product.model.concat(" · "), "").concat(Product.name)
    elif dim == "size":
        key = Variant.size
    else:
        key = func.coalesce(Product.color, "미지정")
    amount = func.coalesce(Movement.qty * Movement.unit_price, 0)
    out_amount_sum = func.coalesce(func.sum(case((Movement.type == "out", amount), else_=0)), 0)
    rows = db.execute(
        select(
            p.label("period"),
            key.label("key"),
            func.coalesce(func.sum(case((Movement.type == "out", Movement.qty), else_=0)), 0),
            out_amount_sum,
            func.coalesce(func.sum(case((Movement.type == "return", Movement.qty), else_=0)), 0),
            func.coalesce(func.sum(case((Movement.type == "return", amount), else_=0)), 0),
        )
        .join(Variant, Movement.variant_id == Variant.id)
        .join(Product, Variant.product_id == Product.id)
        .where(Movement.type.in_(["out", "return"]), Movement.created_at >= since)
        .group_by("period", "key")
        .order_by(p.desc(), out_amount_sum.desc())
    ).all()
    return [
        SalesRow(
            period=r[0], key=r[1], out_qty=r[2], out_amount=int(r[3]),
            return_qty=r[4], return_amount=int(r[5]),
        )
        for r in rows
    ]


@router.get("/clients", response_model=list[ClientSalesRow])
def client_sales(days: int = 365, db: Session = Depends(get_db)):
    """거래처별 매출 (출고액 - 반품액)"""
    since = datetime.combine(date.today() - timedelta(days=days), time.min)
    amount = func.coalesce(Movement.qty * Movement.unit_price, 0)
    rows = db.execute(
        select(
            Client.id,
            Client.name,
            func.coalesce(func.sum(case((Movement.type == "out", Movement.qty), else_=0)), 0),
            func.coalesce(func.sum(case((Movement.type == "return", Movement.qty), else_=0)), 0),
            func.coalesce(
                func.sum(
                    case(
                        (Movement.type == "out", amount),
                        (Movement.type == "return", -amount),
                        else_=0,
                    )
                ),
                0,
            ),
        )
        .join(Movement, Movement.client_id == Client.id)
        .where(Movement.created_at >= since, Movement.type.in_(["out", "return"]))
        .group_by(Client.id, Client.name)
        .order_by(Client.name)
    ).all()
    return [
        ClientSalesRow(
            client_id=r[0], client_name=r[1], out_qty=r[2], return_qty=r[3], sales_amount=int(r[4])
        )
        for r in rows
    ]
