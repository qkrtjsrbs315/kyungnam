from datetime import date, datetime, time, timedelta
from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Client, Movement, Product, Variant
from ..schemas import ClientSalesRow, DashboardOut, MonthlyRow, OutboundRow

router = APIRouter(prefix="/stats", tags=["stats"])


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

    dialect = db.get_bind().dialect.name
    if dialect == "sqlite":
        month_expr = func.strftime("%Y-%m", Movement.created_at)
    else:
        month_expr = func.to_char(Movement.created_at, "YYYY-MM")

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
    fmt = "%Y-%m-%d" if period == "daily" else "%Y-%m"
    since = datetime.combine(date.today() - timedelta(days=days if period == "daily" else 365), time.min)

    dialect = db.get_bind().dialect.name
    if dialect == "sqlite":
        period_expr = func.strftime(fmt.replace("%", "%"), Movement.created_at)
    else:
        period_expr = func.to_char(Movement.created_at, "YYYY-MM-DD" if period == "daily" else "YYYY-MM")

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
