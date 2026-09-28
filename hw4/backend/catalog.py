"""Shared data layer for the Campus Customs shop.

Both the HTTP API (main.py) and the chatbot's tools (tools.py) read the
catalogue through these helpers, so a product looks the same to a shopper
browsing the site and to the agent answering in the chat.
"""

from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "campus_customs.db"
IMAGES_DIR = DATA_DIR / "products"

SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"]
LOW_STOCK_THRESHOLD = 5

Category = Literal["Hoodies", "Crewnecks", "Tees & Tops", "Quarter-Zips", "Jackets & Fleece"]
CATEGORY_ORDER: list[str] = ["Hoodies", "Crewnecks", "Tees & Tops", "Quarter-Zips", "Jackets & Fleece"]


class SizeStock(BaseModel):
    size: str
    quantity: int
    status: Literal["in_stock", "low_stock", "sold_out"]


class ProductSummary(BaseModel):
    id: str
    name: str
    category: Category
    garment_type: str
    short_description: str
    price: float
    colors: list[str]
    image_url: str
    total_stock: int
    sizes_available: int


class ProductDetail(ProductSummary):
    description: str
    search_tags: list[str]
    sizes: list[SizeStock]
    related: list[ProductSummary]


class CategoryCount(BaseModel):
    name: str
    count: int
    image_url: str


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def connect_rw() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def categorize(garment_type: str) -> str:
    g = garment_type.lower()
    if "quarter-zip" in g:
        return "Quarter-Zips"
    if "jacket" in g:
        return "Jackets & Fleece"
    if "hood" in g:
        return "Hoodies"
    if "t-shirt" in g or "long-sleeve" in g:
        return "Tees & Tops"
    return "Crewnecks"


def is_stub(description: str) -> bool:
    return description.startswith("Campus Customs product photo")


def fallback_description(name: str, category: str) -> str:
    noun = {"Tees & Tops": "tee", "Crewnecks": "crewneck", "Hoodies": "hoodie",
            "Quarter-Zips": "quarter-zip", "Jackets & Fleece": "fleece jacket"}[category]
    return (f"The {name} is an official Campus Customs {noun}, made for everyday wear "
            f"across campus and carrying Yale pride well beyond New Haven.")


def first_sentence(text: str) -> str:
    match = re.match(r"(.+?[.!?])(\s|$)", text.strip())
    return (match.group(1) if match else text).strip()


def parse_list(raw: str | None) -> list[str]:
    try:
        value = json.loads(raw or "[]")
        return [str(v) for v in value] if isinstance(value, list) else []
    except json.JSONDecodeError:
        return []


def image_url(path: str) -> str:
    return "/images/" + Path(path).name


def stock_status(quantity: int) -> str:
    if quantity <= 0:
        return "sold_out"
    if quantity <= LOW_STOCK_THRESHOLD:
        return "low_stock"
    return "in_stock"


def load_stock(conn: sqlite3.Connection) -> dict[str, dict[str, int]]:
    stock: dict[str, dict[str, int]] = {}
    for row in conn.execute("SELECT product_id, size, quantity FROM inventory"):
        stock.setdefault(row["product_id"], {})[row["size"]] = row["quantity"]
    return stock


def to_summary(row: sqlite3.Row, sizes: dict[str, int]) -> ProductSummary:
    category = categorize(row["garment_type"])
    description = row["description"]
    short = fallback_description(row["name"], category) if is_stub(description) else first_sentence(description)
    return ProductSummary(
        id=row["product_id"],
        name=row["name"],
        category=category,
        garment_type=row["garment_type"],
        short_description=short,
        price=row["price"],
        colors=parse_list(row["colors"]),
        image_url=image_url(row["image_file_path"]),
        total_stock=sum(sizes.values()),
        sizes_available=sum(1 for q in sizes.values() if q > 0),
    )


def all_summaries() -> list[ProductSummary]:
    with connect() as conn:
        stock = load_stock(conn)
        rows = conn.execute("SELECT * FROM catalogue ORDER BY name").fetchall()
    return [to_summary(r, stock.get(r["product_id"], {})) for r in rows]


def size_breakdown(sizes: dict[str, int]) -> list[SizeStock]:
    return [
        SizeStock(size=s, quantity=sizes.get(s, 0), status=stock_status(sizes.get(s, 0)))
        for s in SIZE_ORDER if s in sizes
    ]
