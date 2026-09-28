"""My Account, wishlist, and checkout for Yale Bulldog Blue.

Everything a signed-in customer owns lives here: their saved pieces (wishlist), orders,
recently viewed products, profile and preferred size, saved shipping address, password,
and the switch to clear what the concierge remembers. Checkout also works for guests.

Orders are priced from the database, never from the browser, and stock is taken off the
shelf in one transaction so two shoppers cannot buy the last hoodie twice.
"""

from __future__ import annotations

import re
import secrets
import sqlite3
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Cookie, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

import auth
from catalog import SIZE_ORDER, ProductSummary, all_summaries, connect, connect_rw, load_stock, stock_status

router = APIRouter()

Size = Literal["XS", "S", "M", "L", "XL", "XXL"]
Fulfillment = Literal["ship", "pickup"]

# Checkout configuration (demo values; the real rates would come from the shop's carrier account).
FREE_SHIPPING_THRESHOLD = 75.00
STANDARD_SHIPPING = 7.95
SALES_TAX_RATE = 0.0635  # Connecticut sales tax
PROCESSING_DAYS = (8, 10)  # business days before an order ships or is ready, per the shop's policy
PICKUP_ADDRESS = "Campus Customs, 57 Broadway, New Haven, CT 06511"
MAX_LINE_QUANTITY = 10
MAX_ORDER_LINES = 30

MIN_PASSWORD_LEN = 8
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# --------------------------------------------------------------------------- schema


def ensure_schema() -> None:
    with connect_rw() as conn:
        user_cols = {r["name"] for r in conn.execute("PRAGMA table_info(users)")}
        if "preferred_size" not in user_cols:
            conn.execute("ALTER TABLE users ADD COLUMN preferred_size TEXT")
        if "shipping_address_json" not in user_cols:
            conn.execute("ALTER TABLE users ADD COLUMN shipping_address_json TEXT")
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS wishlist (
                user_id    INTEGER NOT NULL,
                product_id TEXT    NOT NULL,
                size       TEXT,
                added_at   TEXT    NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (user_id, product_id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (product_id) REFERENCES catalogue(product_id)
            );
            CREATE TABLE IF NOT EXISTS orders (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                order_number     TEXT    NOT NULL UNIQUE,
                user_id          INTEGER,
                email            TEXT    NOT NULL,
                full_name        TEXT    NOT NULL,
                fulfillment      TEXT    NOT NULL CHECK (fulfillment IN ('ship', 'pickup')),
                address_json     TEXT,
                subtotal         REAL    NOT NULL,
                shipping         REAL    NOT NULL,
                tax              REAL    NOT NULL,
                total            REAL    NOT NULL,
                status           TEXT    NOT NULL DEFAULT 'processing',
                estimated_ready  TEXT    NOT NULL,
                created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id, id);
            CREATE TABLE IF NOT EXISTS order_items (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id   INTEGER NOT NULL,
                product_id TEXT    NOT NULL,
                name       TEXT    NOT NULL,
                size       TEXT    NOT NULL,
                unit_price REAL    NOT NULL,
                quantity   INTEGER NOT NULL CHECK (quantity > 0),
                FOREIGN KEY (order_id) REFERENCES orders(id),
                FOREIGN KEY (product_id) REFERENCES catalogue(product_id)
            );
            CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
            """
        )
        conn.commit()


# --------------------------------------------------------------------------- helpers


def user_row(token: str | None) -> sqlite3.Row | None:
    user_id = auth.read_session_token(token, auth.get_secret()) if token else None
    if user_id is None:
        return None
    with connect() as conn:
        return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def require_user(token: str | None) -> sqlite3.Row:
    row = user_row(token)
    if row is None:
        raise HTTPException(status_code=401, detail="Please log in to see your account.")
    return row


def summaries_by_id() -> dict[str, ProductSummary]:
    return {p.id: p for p in all_summaries()}


def business_days_after(start: date, days: int) -> date:
    d = start
    while days > 0:
        d += timedelta(days=1)
        if d.weekday() < 5:
            days -= 1
    return d


def shipping_for(subtotal: float, fulfillment: Fulfillment) -> float:
    if fulfillment == "pickup" or subtotal >= FREE_SHIPPING_THRESHOLD:
        return 0.0
    return STANDARD_SHIPPING


def money(x: float) -> float:
    return round(x + 1e-9, 2)


# --------------------------------------------------------------------------- models


class Address(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    line1: str = Field(min_length=1, max_length=160)
    line2: str = Field(default="", max_length=160)
    city: str = Field(min_length=1, max_length=80)
    state: str = Field(min_length=2, max_length=2)
    zip: str

    @field_validator("full_name", "line1", "line2", "city")
    @classmethod
    def _strip(cls, v: str) -> str:
        return " ".join(v.split())

    @field_validator("state")
    @classmethod
    def _state(cls, v: str) -> str:
        v = v.strip().upper()
        if not re.fullmatch(r"[A-Z]{2}", v):
            raise ValueError("Use the two-letter state code, e.g. CT")
        return v

    @field_validator("zip")
    @classmethod
    def _zip(cls, v: str) -> str:
        v = v.strip()
        if not re.fullmatch(r"\d{5}(-\d{4})?", v):
            raise ValueError("Enter a 5-digit ZIP code")
        return v


class Account(BaseModel):
    id: int
    first_name: str | None
    last_name: str | None
    email: str
    member_since: str
    preferred_size: Size | None
    shipping_address: Address | None
    wishlist_count: int
    order_count: int
    lifetime_spend: float
    chat_message_count: int
    free_shipping_threshold: float


class ProfileUpdate(BaseModel):
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    preferred_size: Size | None = None
    shipping_address: Address | None = None

    @field_validator("first_name", "last_name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be blank")
        return v


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=MIN_PASSWORD_LEN, max_length=200)
    confirm_password: str


class WishlistItem(BaseModel):
    product: ProductSummary
    size: Size | None
    added_at: str
    size_quantity: int | None
    size_status: Literal["in_stock", "low_stock", "sold_out"] | None


class WishlistAdd(BaseModel):
    size: Size | None = None


class OrderLineIn(BaseModel):
    product_id: str = Field(min_length=1, max_length=120)
    size: Size
    quantity: int = Field(ge=1, le=MAX_LINE_QUANTITY)


class CheckoutRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    full_name: str = Field(min_length=1, max_length=120)
    fulfillment: Fulfillment
    address: Address | None = None
    lines: list[OrderLineIn] = Field(min_length=1, max_length=MAX_ORDER_LINES)
    save_address: bool = False

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Please enter a valid email address")
        return v


class OrderLine(BaseModel):
    product_id: str
    name: str
    size: str
    unit_price: float
    quantity: int
    image_url: str | None


class Order(BaseModel):
    order_number: str
    status: str
    created_at: str
    estimated_ready: str
    email: str
    full_name: str
    fulfillment: Fulfillment
    address: Address | None
    pickup_address: str | None
    lines: list[OrderLine]
    item_count: int
    subtotal: float
    shipping: float
    tax: float
    total: float


class StockProblem(BaseModel):
    product_id: str
    name: str
    size: str
    requested: int
    available: int


class CheckoutConfig(BaseModel):
    free_shipping_threshold: float
    standard_shipping: float
    sales_tax_rate: float
    processing_days: tuple[int, int]
    pickup_address: str


# --------------------------------------------------------------------------- account


def load_account(row: sqlite3.Row) -> Account:
    with connect() as conn:
        uid = row["id"]
        wish = conn.execute("SELECT COUNT(*) FROM wishlist WHERE user_id = ?", (uid,)).fetchone()[0]
        orders = conn.execute("SELECT COUNT(*), COALESCE(SUM(total), 0) FROM orders WHERE user_id = ?", (uid,)).fetchone()
        chats = conn.execute("SELECT COUNT(*) FROM chat_messages WHERE user_id = ?", (uid,)).fetchone()[0]
    address = Address.model_validate_json(row["shipping_address_json"]) if row["shipping_address_json"] else None
    return Account(
        id=uid,
        first_name=row["first_name"],
        last_name=row["last_name"],
        email=row["email"],
        member_since=row["created_at"],
        preferred_size=row["preferred_size"],
        shipping_address=address,
        wishlist_count=wish,
        order_count=orders[0],
        lifetime_spend=money(orders[1]),
        chat_message_count=chats,
        free_shipping_threshold=FREE_SHIPPING_THRESHOLD,
    )


@router.get("/api/me/account", response_model=Account)
def get_account(cc_session: str | None = Cookie(default=None)) -> Account:
    return load_account(require_user(cc_session))


@router.put("/api/me/profile", response_model=Account)
def update_profile(body: ProfileUpdate, cc_session: str | None = Cookie(default=None)) -> Account:
    row = require_user(cc_session)
    address = body.shipping_address.model_dump_json() if body.shipping_address else None
    with connect_rw() as conn:
        conn.execute(
            "UPDATE users SET first_name = ?, last_name = ?, name = ?, preferred_size = ?, shipping_address_json = ? WHERE id = ?",
            (body.first_name, body.last_name, f"{body.first_name} {body.last_name}", body.preferred_size, address, row["id"]),
        )
        conn.commit()
        fresh = conn.execute("SELECT * FROM users WHERE id = ?", (row["id"],)).fetchone()
    return load_account(fresh)


@router.post("/api/me/password", status_code=204)
def change_password(body: PasswordChange, cc_session: str | None = Cookie(default=None)) -> None:
    row = require_user(cc_session)
    if not auth.verify_password(body.current_password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="Your current password is not correct.")
    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=400, detail="The new passwords do not match.")
    if body.new_password == body.current_password:
        raise HTTPException(status_code=400, detail="Choose a password you have not used for this account.")
    with connect_rw() as conn:
        conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (auth.hash_password(body.new_password), row["id"]))
        conn.commit()


@router.delete("/api/me/chat-history", status_code=204)
def clear_chat_history(cc_session: str | None = Cookie(default=None)) -> None:
    """Privacy control: forget the saved concierge conversation and browsing memory."""
    row = require_user(cc_session)
    with connect_rw() as conn:
        conn.execute("DELETE FROM chat_messages WHERE user_id = ?", (row["id"],))
        conn.execute("DELETE FROM product_views WHERE user_id = ?", (row["id"],))
        conn.commit()


@router.get("/api/me/recently-viewed", response_model=list[ProductSummary])
def recently_viewed(limit: int = Query(12, ge=1, le=30), cc_session: str | None = Cookie(default=None)) -> list[ProductSummary]:
    row = require_user(cc_session)
    with connect() as conn:
        ids = [r["product_id"] for r in conn.execute(
            "SELECT product_id FROM product_views WHERE user_id = ? ORDER BY last_viewed_at DESC LIMIT ?", (row["id"], limit)
        )]
    products = summaries_by_id()
    return [products[i] for i in ids if i in products]


# --------------------------------------------------------------------------- wishlist


def wishlist_items(user_id: int) -> list[WishlistItem]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT product_id, size, added_at FROM wishlist WHERE user_id = ? ORDER BY added_at DESC, rowid DESC", (user_id,)
        ).fetchall()
        stock = load_stock(conn)
    products = summaries_by_id()
    items = []
    for r in rows:
        product = products.get(r["product_id"])
        if product is None:
            continue
        qty = stock.get(r["product_id"], {}).get(r["size"], 0) if r["size"] else None
        items.append(WishlistItem(
            product=product,
            size=r["size"],
            added_at=r["added_at"],
            size_quantity=qty,
            size_status=stock_status(qty) if qty is not None else None,
        ))
    return items


def add_to_wishlist(user_id: int, product_id: str, size: str | None) -> None:
    """Shared by the API and the concierge's save_to_wishlist action."""
    if product_id not in summaries_by_id():
        raise HTTPException(status_code=404, detail="Product not found")
    with connect_rw() as conn:
        conn.execute(
            "INSERT INTO wishlist (user_id, product_id, size) VALUES (?, ?, ?) "
            "ON CONFLICT(user_id, product_id) DO UPDATE SET size = COALESCE(excluded.size, wishlist.size)",
            (user_id, product_id, size),
        )
        conn.commit()


@router.get("/api/me/wishlist", response_model=list[WishlistItem])
def get_wishlist(cc_session: str | None = Cookie(default=None)) -> list[WishlistItem]:
    return wishlist_items(require_user(cc_session)["id"])


@router.put("/api/me/wishlist/{product_id}", response_model=list[WishlistItem])
def put_wishlist(product_id: str, body: WishlistAdd, cc_session: str | None = Cookie(default=None)) -> list[WishlistItem]:
    row = require_user(cc_session)
    add_to_wishlist(row["id"], product_id, body.size)
    return wishlist_items(row["id"])


@router.delete("/api/me/wishlist/{product_id}", response_model=list[WishlistItem])
def delete_wishlist(product_id: str, cc_session: str | None = Cookie(default=None)) -> list[WishlistItem]:
    row = require_user(cc_session)
    with connect_rw() as conn:
        conn.execute("DELETE FROM wishlist WHERE user_id = ? AND product_id = ?", (row["id"], product_id))
        conn.commit()
    return wishlist_items(row["id"])


# --------------------------------------------------------------------------- orders


def load_orders(conn: sqlite3.Connection, where: str, params: tuple, limit: int = 50) -> list[Order]:
    orders = conn.execute(f"SELECT * FROM orders WHERE {where} ORDER BY id DESC LIMIT ?", (*params, limit)).fetchall()
    products = summaries_by_id()
    result = []
    for o in orders:
        items = conn.execute("SELECT * FROM order_items WHERE order_id = ? ORDER BY id", (o["id"],)).fetchall()
        lines = [
            OrderLine(
                product_id=i["product_id"], name=i["name"], size=i["size"], unit_price=i["unit_price"], quantity=i["quantity"],
                image_url=products[i["product_id"]].image_url if i["product_id"] in products else None,
            )
            for i in items
        ]
        result.append(Order(
            order_number=o["order_number"],
            status=o["status"],
            created_at=o["created_at"],
            estimated_ready=o["estimated_ready"],
            email=o["email"],
            full_name=o["full_name"],
            fulfillment=o["fulfillment"],
            address=Address.model_validate_json(o["address_json"]) if o["address_json"] else None,
            pickup_address=PICKUP_ADDRESS if o["fulfillment"] == "pickup" else None,
            lines=lines,
            item_count=sum(line.quantity for line in lines),
            subtotal=o["subtotal"],
            shipping=o["shipping"],
            tax=o["tax"],
            total=o["total"],
        ))
    return result


def orders_for_user(user_id: int, limit: int = 20) -> list[Order]:
    with connect() as conn:
        return load_orders(conn, "user_id = ?", (user_id,), limit)


@router.get("/api/me/orders", response_model=list[Order])
def my_orders(cc_session: str | None = Cookie(default=None)) -> list[Order]:
    return orders_for_user(require_user(cc_session)["id"])


@router.get("/api/checkout/config", response_model=CheckoutConfig)
def checkout_config() -> CheckoutConfig:
    return CheckoutConfig(
        free_shipping_threshold=FREE_SHIPPING_THRESHOLD,
        standard_shipping=STANDARD_SHIPPING,
        sales_tax_rate=SALES_TAX_RATE,
        processing_days=PROCESSING_DAYS,
        pickup_address=PICKUP_ADDRESS,
    )


@router.post("/api/orders", response_model=Order, status_code=201)
def place_order(body: CheckoutRequest, cc_session: str | None = Cookie(default=None)) -> Order:
    if body.fulfillment == "ship" and body.address is None:
        raise HTTPException(status_code=400, detail="Please add a shipping address.")
    user = user_row(cc_session)

    merged: dict[tuple[str, str], int] = {}
    for line in body.lines:
        merged[(line.product_id, line.size)] = merged.get((line.product_id, line.size), 0) + line.quantity

    conn = connect_rw()
    try:
        conn.execute("BEGIN IMMEDIATE")  # lock writers so stock checks and decrements are atomic
        catalogue = {r["product_id"]: r for r in conn.execute("SELECT product_id, name, price FROM catalogue")}
        stock = load_stock(conn)
        problems: list[StockProblem] = []
        for (pid, size), qty in merged.items():
            if pid not in catalogue:
                raise HTTPException(status_code=400, detail="One of the items in your bag is no longer sold.")
            available = stock.get(pid, {}).get(size, 0)
            if qty > available:
                problems.append(StockProblem(product_id=pid, name=catalogue[pid]["name"], size=size, requested=qty, available=available))
        if problems:
            raise HTTPException(status_code=409, detail={
                "message": "Some sizes sold out while you were shopping. Please update your bag.",
                "problems": [p.model_dump() for p in problems],
            })

        subtotal = money(sum(catalogue[pid]["price"] * qty for (pid, _), qty in merged.items()))
        shipping = shipping_for(subtotal, body.fulfillment)
        tax = money(subtotal * SALES_TAX_RATE)
        total = money(subtotal + shipping + tax)
        ready = business_days_after(datetime.now(timezone.utc).date(), PROCESSING_DAYS[1]).isoformat()
        order_number = "BB-" + "".join(secrets.choice("ACDEFGHJKLMNPQRTUVWXY34679") for _ in range(6))
        address_json = body.address.model_dump_json() if body.fulfillment == "ship" and body.address else None

        cur = conn.execute(
            "INSERT INTO orders (order_number, user_id, email, full_name, fulfillment, address_json, subtotal, shipping, tax, total, estimated_ready) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (order_number, user["id"] if user else None, body.email, " ".join(body.full_name.split()), body.fulfillment,
             address_json, subtotal, shipping, tax, total, ready),
        )
        order_id = cur.lastrowid
        for (pid, size), qty in sorted(merged.items(), key=lambda kv: (catalogue[kv[0][0]]["name"], SIZE_ORDER.index(kv[0][1]))):
            conn.execute(
                "INSERT INTO order_items (order_id, product_id, name, size, unit_price, quantity) VALUES (?, ?, ?, ?, ?, ?)",
                (order_id, pid, catalogue[pid]["name"], size, catalogue[pid]["price"], qty),
            )
            conn.execute("UPDATE inventory SET quantity = quantity - ? WHERE product_id = ? AND size = ?", (qty, pid, size))
        if user and body.save_address and address_json:
            conn.execute("UPDATE users SET shipping_address_json = ? WHERE id = ?", (address_json, user["id"]))
        conn.commit()
        return load_orders(conn, "id = ?", (order_id,))[0]
    except BaseException:
        conn.rollback()
        raise
    finally:
        conn.close()


def order_summary_for_agent(user_id: int, limit: int = 5) -> list[dict]:
    """Compact order list for the concierge's get_my_orders tool."""
    return [
        {
            "order_number": o.order_number,
            "placed": o.created_at[:10],
            "status": o.status,
            "fulfillment": "in-store pickup at 57 Broadway" if o.fulfillment == "pickup" else "shipping",
            "estimated_ready_or_ship_by": o.estimated_ready,
            "items": [f"{line.quantity} x {line.name} ({line.size})" for line in o.lines],
            "total": o.total,
        }
        for o in orders_for_user(user_id, limit)
    ]


def wishlist_for_agent(user_id: int) -> list[dict]:
    return [
        {
            "product_id": w.product.id,
            "name": w.product.name,
            "price": w.product.price,
            "saved_size": w.size,
            "saved_size_stock": w.size_status,
        }
        for w in wishlist_items(user_id)
    ]
