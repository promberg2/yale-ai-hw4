"""Customer memory for the Bulldog Blue Concierge.

Signed-in customers get a memory across visits, stored in campus_customs.db:

- `chat_messages`  every chat turn (the seeded table), plus `page_json`: what
                   the customer was viewing when they asked.
- `product_views`  one row per customer and product they opened, with a view
                   count and first/last viewed time.

Everything here reads or writes only the rows of the customer whose session
cookie made the request. Guests can chat, but nothing about them is stored.
"""

from __future__ import annotations

import json
import re
import sqlite3
from collections import Counter
from datetime import datetime, timezone

import catalog
from models import BagLine, CustomerProfile, PageContext, ViewedProduct

HISTORY_FOR_PROFILE = 200
SIZE_WORDS = {
    "extra small": "XS", "x-small": "XS", "xs": "XS", "small": "S", "medium": "M",
    "large": "L", "extra large": "XL", "x-large": "XL", "xl": "XL",
    "xx-large": "XXL", "2xl": "XXL", "xxl": "XXL",
}
SIZE_WORD_RE = re.compile(r"\b(extra small|x-small|extra large|x-large|xx-large|2xl|xxl|xl|xs|small|medium|large)\b", re.I)
SIZE_LETTER_RE = re.compile(r"\b(?:size|in|an?|my|wear|wears)\s+(s|m|l)\b", re.I)
CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


# --------------------------------------------------------------------------- schema


def ensure_schema() -> None:
    """Idempotent migration, run at startup: adds the memory columns, table, and indexes."""
    with catalog.connect_rw() as conn:
        columns = {r["name"] for r in conn.execute("PRAGMA table_info(chat_messages)")}
        if "page_json" not in columns:
            conn.execute("ALTER TABLE chat_messages ADD COLUMN page_json TEXT")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages (user_id, id)")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS product_views (
                user_id         INTEGER NOT NULL,
                product_id      TEXT    NOT NULL,
                view_count      INTEGER NOT NULL DEFAULT 1,
                first_viewed_at TEXT    NOT NULL DEFAULT (datetime('now')),
                last_viewed_at  TEXT    NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (user_id, product_id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (product_id) REFERENCES catalogue(product_id)
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_product_views_recent ON product_views (user_id, last_viewed_at)")
        conn.commit()


# --------------------------------------------------------------------------- page context


def _clean_text(text: str | None, limit: int) -> str | None:
    if not text:
        return None
    text = CONTROL_CHARS.sub(" ", text).strip()
    return text[:limit] or None


def clean_page_context(page: PageContext | None) -> PageContext | None:
    """Keep only what matches the catalogue: unknown ids, sizes, and departments are dropped."""
    if page is None:
        return None
    with catalog.connect() as conn:
        known = {r["product_id"] for r in conn.execute("SELECT product_id FROM catalogue")}

    def real(ids: list[str]) -> list[str]:
        return list(dict.fromkeys(pid for pid in ids if pid in known))

    size = (page.selected_size or "").strip().upper()
    bag = [
        BagLine(product_id=line.product_id, size=line.size.strip().upper(), quantity=line.quantity)
        for line in page.bag
        if line.product_id in known and line.size.strip().upper() in catalog.SIZE_ORDER
    ]
    product_id = page.product_id if page.product_id in known else None
    return PageContext(
        page_type=page.page_type if (page.page_type != "product" or product_id) else "other",
        path=_clean_text(page.path, 200) or "/",
        product_id=product_id,
        selected_size=size if product_id and size in catalog.SIZE_ORDER else None,
        category=page.category if page.category in catalog.CATEGORY_ORDER else None,
        search=_clean_text(page.search, 100),
        sort=_clean_text(page.sort, 20),
        concierge_headline=_clean_text(page.concierge_headline, 120),
        concierge_query=_clean_text(page.concierge_query, 300),
        concierge_product_ids=real(page.concierge_product_ids),
        bag=bag,
        recently_viewed=real(page.recently_viewed),
    )


# --------------------------------------------------------------------------- views


def record_view(user_id: int, product_id: str) -> bool:
    with catalog.connect_rw() as conn:
        if conn.execute("SELECT 1 FROM catalogue WHERE product_id = ?", (product_id,)).fetchone() is None:
            return False
        conn.execute(
            """
            INSERT INTO product_views (user_id, product_id) VALUES (?, ?)
            ON CONFLICT (user_id, product_id)
            DO UPDATE SET view_count = view_count + 1, last_viewed_at = datetime('now')
            """,
            (user_id, product_id),
        )
        conn.commit()
    return True


def recent_views(conn: sqlite3.Connection, user_id: int, limit: int = 8) -> list[ViewedProduct]:
    rows = conn.execute(
        """
        SELECT v.product_id, v.view_count, v.last_viewed_at, c.name, c.garment_type, c.price
        FROM product_views v JOIN catalogue c ON c.product_id = v.product_id
        WHERE v.user_id = ? ORDER BY v.last_viewed_at DESC, v.view_count DESC LIMIT ?
        """,
        (user_id, limit),
    ).fetchall()
    return [
        ViewedProduct(
            product_id=r["product_id"], name=r["name"], category=catalog.categorize(r["garment_type"]),
            price=r["price"], times_viewed=r["view_count"], last_viewed_at=r["last_viewed_at"],
        )
        for r in rows
    ]


# --------------------------------------------------------------------------- chat history


def products_snapshot(conn: sqlite3.Connection, product_ids: list[str]) -> str:
    """Same products_json shape as the seeded chat_messages rows."""
    snapshot = []
    for pid in product_ids:
        row = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (pid,)).fetchone()
        if row:
            snapshot.append({
                "product_id": row["product_id"],
                "name": row["name"],
                "garment_type": row["garment_type"],
                "description": row["description"],
                "colors": catalog.parse_list(row["colors"]),
                "search_tags": catalog.parse_list(row["search_tags"]),
                "price": row["price"],
            })
    return json.dumps(snapshot)


def save_turns(user_id: int, message: str, reply: str, product_ids: list[str], page: PageContext | None) -> None:
    page_json = page.model_dump_json(exclude_defaults=True) if page else None
    with catalog.connect_rw() as conn:
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json, page_json) VALUES (?, 'user', ?, NULL, ?)",
            (user_id, message, page_json),
        )
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, 'assistant', ?, ?)",
            (user_id, reply, products_snapshot(conn, product_ids)),
        )
        conn.commit()


def product_ids_of(products_json: str | None) -> list[str]:
    try:
        return [p["product_id"] for p in json.loads(products_json or "[]") if isinstance(p, dict) and "product_id" in p]
    except (json.JSONDecodeError, TypeError):
        return []


def load_history(user_id: int, limit: int) -> list[sqlite3.Row]:
    """The customer's most recent saved messages, oldest first."""
    with catalog.connect() as conn:
        rows = conn.execute(
            "SELECT id, role, content, products_json, page_json, created_at FROM chat_messages "
            "WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    return list(reversed(rows))


# --------------------------------------------------------------------------- profile


def _sizes_in(text: str) -> list[str]:
    found = [SIZE_WORDS[m.lower()] for m in SIZE_WORD_RE.findall(text)]
    found += [m.upper() for m in SIZE_LETTER_RE.findall(text)]
    return found


def load_profile(user: sqlite3.Row) -> CustomerProfile:
    """The signed-in customer's profile: account fields plus what their own history shows."""
    user_id = user["id"]
    with catalog.connect() as conn:
        stats = conn.execute(
            "SELECT COUNT(*) n, MIN(created_at) first, MAX(created_at) last FROM chat_messages WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        rows = conn.execute(
            "SELECT role, content, products_json FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, HISTORY_FOR_PROFILE),
        ).fetchall()
        views = recent_views(conn, user_id, limit=8)
        viewed_all = conn.execute(
            "SELECT c.garment_type, v.view_count FROM product_views v JOIN catalogue c ON c.product_id = v.product_id "
            "WHERE v.user_id = ?",
            (user_id,),
        ).fetchall()
        shown_ids = [pid for r in rows if r["role"] == "assistant" for pid in product_ids_of(r["products_json"])]
        shown_types = {
            r["product_id"]: r["garment_type"]
            for r in conn.execute(
                f"SELECT product_id, garment_type FROM catalogue WHERE product_id IN ({','.join('?' * len(set(shown_ids)))})",
                list(set(shown_ids)),
            )
        } if shown_ids else {}
        saved_pieces = conn.execute("SELECT COUNT(*) FROM wishlist WHERE user_id = ?", (user_id,)).fetchone()[0]
        orders = conn.execute("SELECT COUNT(*) FROM orders WHERE user_id = ?", (user_id,)).fetchone()[0]

    sizes = Counter(s for r in rows if r["role"] == "user" for s in _sizes_in(r["content"]))
    categories: Counter[str] = Counter()
    for pid in shown_ids:
        if pid in shown_types:
            categories[catalog.categorize(shown_types[pid])] += 1
    for v in viewed_all:
        categories[catalog.categorize(v["garment_type"])] += 2 * v["view_count"]

    created = str(user["created_at"] or "")
    try:
        since = datetime.fromisoformat(created.replace(" ", "T")).replace(tzinfo=timezone.utc)
        days = max(0, (datetime.now(timezone.utc) - since).days)
    except ValueError:
        days = 0
    first = user["first_name"] or (user["name"] or "").split(" ")[0] or "there"
    questions = [
        CONTROL_CHARS.sub(" ", r["content"])[:140] for r in rows if r["role"] == "user"
    ][:5]

    return CustomerProfile(
        first_name=first,
        last_name=user["last_name"],
        full_name=user["name"],
        email=user["email"],
        member_since=created[:10],
        days_as_member=days,
        saved_messages=stats["n"],
        first_chat_at=stats["first"],
        last_chat_at=stats["last"],
        sizes_mentioned=[s for s, _ in sizes.most_common(3)],
        favorite_categories=[c for c, _ in categories.most_common(3)],
        recently_viewed=views,
        recent_questions=questions,
        preferred_size=user["preferred_size"] if "preferred_size" in user.keys() else None,
        wishlist_count=saved_pieces,
        order_count=orders,
    )
