"""로컬 확인용 데모 데이터 (여러 달에 걸친 입출고)"""
import random
from datetime import datetime, timedelta

from app.database import Base, SessionLocal, engine
from app.models import Brand, Client, ClientPrice, Movement, Product, Variant, SHOE_SIZES

random.seed(42)
Base.metadata.create_all(bind=engine)

with SessionLocal() as db:
    if not db.query(Brand).count():
        db.add_all([Brand(name="에어워크"), Brand(name="엘에이기어")])
        db.commit()
    aw = db.query(Brand).filter_by(name="에어워크").first()

    p1 = Product(category="shoe", name="다이얼 안전화", model="AW-600D", color="BLACK",
                 work_type="normal", brand_id=aw.id, low_stock_threshold=10)
    for s in SHOE_SIZES:
        p1.variants.append(Variant(size=s, stock=random.randint(5, 60)))
    p2 = Product(category="goods", name="쿨링 스카프", item_type="스카프", color="GRAY", low_stock_threshold=10)
    for s in ["S", "M", "L"]:
        p2.variants.append(Variant(size=s, stock=random.randint(10, 40)))
    c1 = Client(name="OO건설", contact="010-1234-5678")
    db.add_all([p1, p2, c1])
    db.commit()
    db.add(ClientPrice(client_id=c1.id, product_id=p1.id, unit_price=35000))

    now = datetime.now()
    for back in range(11, -1, -1):
        month_start = (now.replace(day=15) - timedelta(days=30 * back))
        n_in = random.randint(3, 8)
        n_out = random.randint(4, 10)
        n_ret = random.randint(0, 3)
        for _ in range(n_in):
            v = random.choice(p1.variants + p2.variants)
            db.add(Movement(type="in", variant_id=v.id, qty=random.randint(10, 40),
                            created_at=month_start + timedelta(days=random.randint(0, 12))))
        for _ in range(n_out):
            v = random.choice(p1.variants + p2.variants)
            db.add(Movement(type="out", variant_id=v.id, qty=random.randint(5, 30),
                            client_id=c1.id, unit_price=35000,
                            created_at=month_start + timedelta(days=random.randint(0, 12))))
        for _ in range(n_ret):
            v = random.choice(p1.variants)
            db.add(Movement(type="return", variant_id=v.id, qty=random.randint(1, 5),
                            client_id=c1.id, unit_price=35000,
                            created_at=month_start + timedelta(days=random.randint(0, 12))))
    db.commit()
    print("seeded:", db.query(Movement).count(), "movements")
