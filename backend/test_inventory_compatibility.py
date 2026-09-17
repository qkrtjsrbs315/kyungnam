"""Run with: python -m unittest test_inventory_compatibility (isolated SQLite)."""
import os
import unittest
from datetime import datetime

os.environ["DATABASE_URL"] = "sqlite://"

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import Brand, Product, Variant, Movement
from app.routers import brands, products, stats


class InventoryCompatibility(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        brand = Brand(name="엘에이기어")
        p = Product(category="shoe", name="기존 제품", brand=brand)
        p.variants = [Variant(size="250", stock=12), Variant(size="260", stock=8)]
        other = Product(category="goods", name="기존 용품", variants=[Variant(size="M", stock=3)])
        self.db.add_all([p, other])
        self.db.flush()
        self.product_id, self.brand_id = p.id, brand.id
        for v, qty, kind, when in [
            (p.variants[0], 4, "out", datetime(2026, 8, 31, 15)),
            (p.variants[0], 3, "out", datetime(2026, 9, 10)),
            (p.variants[1], 9, "out", datetime(2026, 9, 11)),
            (p.variants[1], 2, "return", datetime(2026, 9, 12)),
            (p.variants[0], 50, "out", datetime(2026, 8, 31, 14, 59)),
            (p.variants[0], 60, "out", datetime(2026, 9, 30, 15)),
            (other.variants[0], 1, "out", datetime(2026, 9, 12)),
        ]:
            self.db.add(Movement(variant=v, qty=qty, type=kind, created_at=when))
        self.db.commit()
        app = FastAPI()
        for router in [brands.router, products.router, stats.router]:
            app.include_router(router)
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.db.close()
        self.engine.dispose()

    def test_old_brand_display_and_duplicate_alias(self):
        self.assertEqual(self.client.get("/brands").json(), [{"id": self.brand_id, "name": "LA기어"}])
        self.assertEqual(self.client.post("/brands", json={"name": " LA기어 "}).status_code, 409)
        self.assertEqual(self.db.get(Brand, self.brand_id).name, "엘에이기어")
        self.assertEqual(self.client.post("/brands", json={"name": "  "}).status_code, 422)

    def test_month_boundary_ranking_and_unassigned_products(self):
        response = self.client.get("/stats/outbound?period=monthly&month=2026-09")
        self.assertEqual(response.status_code, 200, response.text)
        rows = response.json()
        self.assertEqual([r["qty"] for r in rows], [9, 7, 1])
        self.assertEqual([r["brand_name"] for r in rows], ["LA기어", "LA기어", None])
        self.assertTrue(all(r["period"] == "2026-09" for r in rows))
        self.assertEqual(self.client.get("/stats/outbound?month=2026-13").status_code, 422)
        self.assertEqual(self.client.get("/stats/outbound?period=monthly&month=2020-01").json(), [])
        self.assertEqual(self.client.get("/stats/outbound?period=monthly").status_code, 200)

    def test_existing_ids_stock_and_history_survive_brand_edit(self):
        before = [(v.id, v.stock) for v in self.db.scalars(select(Variant))]
        history = [m.id for m in self.db.scalars(select(Movement))]
        new = self.client.post("/brands", json={"name": "새 브랜드"}).json()
        response = self.client.patch(f"/products/{self.product_id}", json={"brand_id": new["id"]})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["brand"]["id"], new["id"])
        self.assertEqual(before, [(v.id, v.stock) for v in self.db.scalars(select(Variant))])
        self.assertEqual(history, [m.id for m in self.db.scalars(select(Movement))])
        self.assertEqual(self.client.patch(f"/products/{self.product_id}", json={"brand_id": 999}).status_code, 422)
        response = self.client.post("/products", json={"category": "goods", "name": "용품", "brand_id": new["id"]})
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["brand"]["id"], new["id"])


if __name__ == "__main__":
    unittest.main()
