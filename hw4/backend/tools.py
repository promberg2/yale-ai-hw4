"""Tools the Campus Customs agent can call.

Every fact the agent states about a product — name, description, price,
colors, sizes, stock — must come from one of these functions, which read the
live SQLite database on every call. Each tool returns a typed model from
models.py, so the agent always receives the same named fields.

Customer tools only ever read the signed-in customer's own rows (their id
comes from the session cookie via ShopDeps, never from the model). They
never return password hashes or anything about other customers.

The two action tools (add_to_bag, save_to_wishlist) check live stock first
and record what they did in ShopDeps.actions, which goes back to the website
with the reply so the customer sees a confirmation.
"""

from __future__ import annotations

import functools
import json
import re
import sqlite3
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from pydantic_ai import RunContext

import account
import catalog
import customers
from models import (
    AlternativeProduct,
    BagItemStatus,
    CategoryOverview,
    ChatAction,
    CurrentPage,
    CustomerProfile,
    PageContext,
    PriceLookup,
    PriceQuote,
    ProductBrief,
    ProductCard,
    ProductInfo,
    ProductMatch,
    ProductMatches,
    SearchResults,
    ShopDeps,
    ShoppingContext,
    SizeAvailability,
    StockReport,
    ToolError,
)

SYNONYMS: dict[str, str] = {
    "tee": "t-shirt", "tees": "t-shirt", "tshirt": "t-shirt", "shirt": "t-shirt",
    "sweatshirt": "crewneck", "crew": "crewneck", "sweater": "crewneck",
    "hood": "hoodie", "hoody": "hoodie", "pullover": "hoodie",
    "zip": "quarter-zip", "quarterzip": "quarter-zip", "1/4": "quarter-zip",
    "fleece": "fleece", "jacket": "jacket", "coat": "jacket",
    "grey": "gray", "heather": "heather",
    "mom": "mom", "mother": "mom", "dad": "dad", "father": "dad",
}
STOPWORDS = set(
    "a an the and or for with of in on to my me i im some any show find looking look want need "
    "get buy please can could would like what which do you have has is are it this that under "
    "over below above than less more cheap cheaper around about good nice best new".split()
)
COLOR_ALIASES: dict[str, list[str]] = {
    "gray": ["gray", "grey", "heather"],
    "grey": ["gray", "grey", "heather"],
    "blue": ["blue", "navy"],
    "navy": ["navy"],
    "white": ["white", "ivory", "cream", "oatmeal"],
    "pink": ["pink", "coral", "rose"],
}
SIZE_ALIASES: dict[str, str] = {
    "EXTRA SMALL": "XS", "X-SMALL": "XS", "SMALL": "S", "MEDIUM": "M", "MED": "M", "LARGE": "L",
    "EXTRA LARGE": "XL", "X-LARGE": "XL", "XX-LARGE": "XXL", "2XL": "XXL", "2X": "XXL",
}

STORE_INFO: dict[str, str] = {
    "about": (
        "Yale Bulldog Blue is the online store of Campus Customs, New Haven's oldest official Yale "
        "merchandise retailer. Barry Cobden opened the store on Broadway, directly across from campus, "
        "in 1975. The family business is now run by brothers Joel and Jeremy Cobden, with more than 65 "
        "people through the year and stores in New Haven, Branford, and Celebration, Florida. Campus "
        "Customs developed the original replica Y sweater (100% cotton, sewn-on felt Y), still a staple "
        "more than forty years later."
    ),
    "licensing": "Everything we sell is officially licensed Yale apparel.",
    "production": (
        "Screen printing, embroidery, and digital printing happen in our own production facility next "
        "door to the original store on Broadway (the former York Square Cinema), which gives quick "
        "turnarounds and real quality control. We also do custom merchandise for organizations, "
        "businesses, and family reunions."
    ),
    "shipping": (
        "Processing time for most items is 8-10 business days before shipment. Times may vary with order "
        "volume around holidays and large sitewide promotions. Shipping and taxes are calculated at checkout."
    ),
    "returns": (
        "We accept returns and exchanges on standard items. For help with a return or exchange, customers "
        "can email orderdept@campuscustoms.com or visit the store."
    ),
    "store": (
        "Flagship store: 57 Broadway, New Haven, CT 06511, directly across from campus. Open seven days a "
        "week. Customers are welcome to stop by to try on sizes, find a gift, or say hello."
    ),
    "contact": "Order help: orderdept@campuscustoms.com. Or visit us at 57 Broadway, New Haven, CT 06511.",
    "sizing": (
        "Every garment is offered in XS, S, M, L, XL, and XXL. We do not publish measurement charts online; "
        "for fit advice customers can try pieces on at 57 Broadway or email orderdept@campuscustoms.com."
    ),
    "account": (
        "Customers can create an account (first name, last name, email, password) or log in from the top "
        "navigation. Signed-in customers get a personal greeting and their chat is remembered."
    ),
    "ordering": (
        "Customers add a size to their bag on any product page. The chat assistant cannot place, change, "
        "cancel, or look up orders, apply discounts, or take payment."
    ),
}


# --------------------------------------------------------------------------- helpers


def _tokens(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9/'-]+", text.lower())
    out: list[str] = []
    for w in words:
        w = SYNONYMS.get(w, w)
        if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
            w = SYNONYMS.get(w[:-1], w[:-1])
        if w not in STOPWORDS and len(w) > 1:
            out.append(w)
    return out


def _normalize_size(size: str | None) -> str | None:
    if not size:
        return None
    s = size.strip().upper()
    return SIZE_ALIASES.get(s, s)


def _load_rows() -> tuple[list[sqlite3.Row], dict[str, dict[str, int]]]:
    with catalog.connect() as conn:
        rows = conn.execute("SELECT * FROM catalogue").fetchall()
        stock = catalog.load_stock(conn)
    return rows, stock


def _get_row(product_id: str) -> tuple[sqlite3.Row | None, dict[str, int]]:
    with catalog.connect() as conn:
        row = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (product_id.strip(),)).fetchone()
        if row is None:
            return None, {}
        rows = conn.execute("SELECT size, quantity FROM inventory WHERE product_id = ?", (row["product_id"],))
        return row, {r["size"]: r["quantity"] for r in rows}


def _not_found(product_id: str) -> ToolError:
    return ToolError(
        error=f"No product with id '{product_id}' exists in the catalogue.",
        hint="Use find_product with the product's name, or search_products, to get the correct product_id.",
    )


def _in_stock(sizes: dict[str, int]) -> list[str]:
    return [s for s in catalog.SIZE_ORDER if sizes.get(s, 0) > 0]


def _sold_out(sizes: dict[str, int]) -> list[str]:
    return [s for s in catalog.SIZE_ORDER if s in sizes and sizes[s] <= 0]


def _size_message(size: str, quantity: int) -> str:
    """Same wording as the size messages on the product page."""
    if quantity <= 0:
        return f"Size {size} is sold out."
    if quantity <= catalog.LOW_STOCK_THRESHOLD:
        return f"Only {quantity} left in size {size} — order soon."
    return f"In stock — {quantity} available in size {size}."


def _nearest_sizes(size: str, sizes: dict[str, int]) -> list[str]:
    if size not in catalog.SIZE_ORDER:
        return _in_stock(sizes)
    i = catalog.SIZE_ORDER.index(size)
    candidates = [s for s in _in_stock(sizes) if s != size]
    return sorted(candidates, key=lambda s: (abs(catalog.SIZE_ORDER.index(s) - i), catalog.SIZE_ORDER.index(s)))[:2]


def _similar_in_size(row: sqlite3.Row, size: str, limit: int = 3) -> list[AlternativeProduct]:
    """Products in the same department that ARE in stock in the requested size, most similar first."""
    rows, stock = _load_rows()
    category = catalog.categorize(row["garment_type"])
    colors = set(c.lower() for c in catalog.parse_list(row["colors"]))
    tags = set(t.lower() for t in catalog.parse_list(row["search_tags"]))
    scored = []
    for other in rows:
        if other["product_id"] == row["product_id"] or catalog.categorize(other["garment_type"]) != category:
            continue
        qty = stock.get(other["product_id"], {}).get(size, 0)
        if qty <= 0 or catalog.is_stub(other["description"]):
            continue
        other_colors = catalog.parse_list(other["colors"])
        overlap = len(colors & {c.lower() for c in other_colors}) * 2 + len(tags & {t.lower() for t in catalog.parse_list(other["search_tags"])})
        closeness = -abs(other["price"] - row["price"]) / 100
        scored.append((overlap + closeness, AlternativeProduct(
            product_id=other["product_id"], name=other["name"], price=other["price"],
            colors=other_colors, quantity_in_size=qty,
        )))
    scored.sort(key=lambda s: -s[0])
    return [alt for _, alt in scored[:limit]]


def product_card(product_id: str) -> ProductCard | None:
    """Build the card the chat widget renders, straight from the database."""
    row, sizes = _get_row(product_id)
    if row is None:
        return None
    summary = catalog.to_summary(row, sizes)
    in_stock = _in_stock(sizes)
    return ProductCard(
        id=summary.id,
        name=summary.name,
        price=summary.price,
        category=summary.category,
        image_url=summary.image_url,
        url=f"/products/{summary.id}",
        in_stock=bool(in_stock),
        sizes_available=in_stock,
    )


def product_exists(product_id: str) -> bool:
    with catalog.connect() as conn:
        return conn.execute("SELECT 1 FROM catalogue WHERE product_id = ?", (product_id,)).fetchone() is not None


# --------------------------------------------------------------------------- discovery tools


def search_products(
    ctx: RunContext[ShopDeps],
    query: str | None = None,
    category: str | None = None,
    color: str | None = None,
    max_price: float | None = None,
    min_price: float | None = None,
    size: str | None = None,
    limit: int = 8,
) -> SearchResults:
    """Search the live Campus Customs catalogue by description. Use this to discover products to recommend.

    Args:
        query: Free-text keywords, e.g. 'Pierson college', 'football', 'Harvard Yale', 'big yale',
            'law school', 'dad'. Leave empty to browse with filters only.
        category: One of 'Hoodies', 'Crewnecks', 'Tees & Tops', 'Quarter-Zips', 'Jackets & Fleece'.
        color: A color the customer wants, e.g. 'navy', 'gray', 'white', 'pink'.
        max_price: Highest price in USD the customer will pay.
        min_price: Lowest price in USD.
        size: Only return products currently in stock in this size (XS, S, M, L, XL, XXL).
        limit: Maximum number of results (1-36). Use 36 when you will show the results on the page.
    """
    rows, stock = _load_rows()
    terms = _tokens(query or "")
    size = _normalize_size(size)
    limit = max(1, min(limit, 36))

    scored: list[tuple[float, ProductBrief]] = []
    for row in rows:
        sizes = stock.get(row["product_id"], {})
        cat = catalog.categorize(row["garment_type"])
        colors = [c.lower() for c in catalog.parse_list(row["colors"])]

        if category and cat.lower() != category.lower().strip():
            continue
        if max_price is not None and row["price"] > max_price:
            continue
        if min_price is not None and row["price"] < min_price:
            continue
        if size and sizes.get(size, 0) <= 0:
            continue
        if color:
            wanted = COLOR_ALIASES.get(color.lower().strip(), [color.lower().strip()])
            if not any(w in c for w in wanted for c in colors):
                continue

        score = 0.0
        if terms:
            name = row["name"].lower()
            tags = " ".join(catalog.parse_list(row["search_tags"])).lower()
            garment = row["garment_type"].lower()
            desc = row["description"].lower()
            for t in terms:
                score += 3 * (t in name) + 2 * (t in tags) + 2 * (t in garment) + 1 * (t in desc)
            if score == 0:
                continue
        summary = catalog.to_summary(row, sizes)
        brief = ProductBrief(
            product_id=summary.id, name=summary.name, category=summary.category, price=summary.price,
            colors=summary.colors, summary=summary.short_description, sizes_in_stock=_in_stock(sizes),
        )
        scored.append((score + len(brief.sizes_in_stock) / 10, brief))

    scored.sort(key=lambda s: (-s[0], s[1].name))
    results = [item for _, item in scored[:limit]]
    ctx.deps.seen_product_ids.update(r.product_id for r in results)
    ctx.deps.last_search_ids = [r.product_id for r in results]
    return SearchResults(match_count=len(scored), results=results)


def find_product(ctx: RunContext[ShopDeps], name: str) -> ProductMatches:
    """Resolve a product the customer names ('the Big Yale hoodie', 'Pierson crewneck') to its product_id.

    Use this when the customer asks about a specific product by name and you do not already have its id.

    Args:
        name: The product name or the distinctive words of it, as the customer wrote it.
    """
    top = [m for _, m in _match_products(name)[:5]]
    ctx.deps.seen_product_ids.update(m.product_id for m in top)
    return ProductMatches(query=name, matches=top)


def _match_products(name: str) -> list[tuple[int, ProductMatch]]:
    """Catalogue products whose name matches `name`, best first, with their match scores."""
    wanted = name.strip().lower()
    terms = [t for t in _tokens(name) if t not in {"yale"}] or _tokens(name)
    rows, _ = _load_rows()
    matches: list[tuple[int, ProductMatch]] = []
    for row in rows:
        product_name = row["name"].lower()
        if wanted in (product_name, row["product_id"]):
            kind, score = "exact", 1000
        else:
            hay = f"{product_name} {row['garment_type'].lower()}"
            hits = sum(1 for t in terms if t in hay)
            if not terms or hits < max(1, round(len(terms) * 0.6)):
                continue
            kind, score = "partial", hits * 10 - len(product_name) // 10
        matches.append((score, ProductMatch(
            product_id=row["product_id"], name=row["name"], category=catalog.categorize(row["garment_type"]),
            price=row["price"], match=kind,
        )))
    matches.sort(key=lambda m: -m[0])
    return matches


def _resolve(ctx: RunContext[ShopDeps], product: str) -> str | ToolError:
    """A product_id from either an id or a product name, so one tool call can answer a named product.
    Ambiguous names come back as a ToolError listing the candidates to ask the customer about."""
    key = product.strip()
    if product_exists(key):
        return key
    matches = _match_products(key)
    if not matches:
        return _not_found(key)
    best_score, best = matches[0]
    runner_up = matches[1][0] if len(matches) > 1 else -1
    if best.match == "exact" or best_score - runner_up >= 10:
        return best.product_id
    options = "; ".join(f"{m.name} (`{m.product_id}`)" for _, m in matches[:3])
    ctx.deps.seen_product_ids.update(m.product_id for _, m in matches[:3])
    return ToolError(
        error=f"'{key}' matches several products: {options}.",
        hint="Ask the customer which one they mean, and show these as cards (their ids are listed).",
    )


def list_categories(ctx: RunContext[ShopDeps]) -> list[CategoryOverview]:
    """Overview of the shop's departments with product counts and price ranges."""
    products = catalog.all_summaries()
    out = []
    for name in catalog.CATEGORY_ORDER:
        members = [p for p in products if p.category == name]
        if members:
            prices = [p.price for p in members]
            out.append(CategoryOverview(category=name, products=len(members), price_from=min(prices), price_to=max(prices)))
    return out


# --------------------------------------------------------------------------- product info, price, stock


def get_product_info(ctx: RunContext[ShopDeps], product: str) -> ProductInfo | ToolError:
    """Everything the catalogue records about one product: description, colors, style tags, price, and which sizes are in stock.

    Use this when the customer asks what a product is like, what it is made to look like, or what colors it comes in.

    Args:
        product: The product_id, or the product's name as the customer wrote it (no need to call find_product first).
    """
    product_id = _resolve(ctx, product)
    if isinstance(product_id, ToolError):
        return product_id
    row, sizes = _get_row(product_id)
    if row is None:
        return _not_found(product_id)
    summary = catalog.to_summary(row, sizes)
    stub = catalog.is_stub(row["description"])
    ctx.deps.seen_product_ids.add(summary.id)
    return ProductInfo(
        product_id=summary.id,
        name=summary.name,
        category=summary.category,
        garment_type=summary.garment_type,
        description=summary.short_description if stub else row["description"],
        colors=summary.colors,
        colors_recorded=bool(summary.colors),
        style_tags=catalog.parse_list(row["search_tags"]),
        price=summary.price,
        sizes_offered=[s for s in catalog.SIZE_ORDER if s in sizes],
        sizes_in_stock=_in_stock(sizes),
        sizes_sold_out=_sold_out(sizes),
        page_url=f"/products/{summary.id}",
        data_note=(
            "This product has only a placeholder description in our records: do not describe its colors, "
            "graphics, or details beyond its name and category." if stub else None
        ),
    )


def get_price(ctx: RunContext[ShopDeps], products: list[str]) -> PriceLookup:
    """Exact current price for one or more products. Use for any price question or price comparison.

    Args:
        products: One or more product_id values or product names (up to 10).
    """
    quotes: list[PriceQuote] = []
    missing: list[str] = []
    with catalog.connect() as conn:
        for wanted in products[:10]:
            pid = _resolve(ctx, wanted)
            row = None if isinstance(pid, ToolError) else conn.execute(
                "SELECT product_id, name, price FROM catalogue WHERE product_id = ?", (pid,)
            ).fetchone()
            if row is None:
                missing.append(wanted)
                continue
            price = float(row["price"])
            display = f"${price:,.0f}" if price.is_integer() else f"${price:,.2f}"
            quotes.append(PriceQuote(product_id=row["product_id"], name=row["name"], price=price, display=display))
    ctx.deps.seen_product_ids.update(q.product_id for q in quotes)
    return PriceLookup(quotes=quotes, not_found=missing)


def get_stock_by_size(ctx: RunContext[ShopDeps], product: str, size: str | None = None) -> StockReport | ToolError:
    """Live stock for a product from the inventory table: the quantity and status of every size.

    Call this before saying whether a size is available or how many are left (unless the page context
    already lists live stock for the open product). If you pass the size the customer asked for and it
    is sold out, the report also lists the nearest sizes that are in stock and similar products that
    are in stock in that size. One call answers the question: never repeat it with the same arguments.

    Args:
        product: The product_id, or the product's name as the customer wrote it (no need to call find_product first).
        size: The size the customer asked about (XS, S, M, L, XL, XXL). Omit to get every size.
    """
    product_id = _resolve(ctx, product)
    if isinstance(product_id, ToolError):
        return product_id
    row, sizes = _get_row(product_id)
    if row is None:
        return _not_found(product_id)
    ctx.deps.seen_product_ids.add(row["product_id"])

    breakdown = [
        SizeAvailability(size=s.size, quantity=s.quantity, status=s.status, customer_message=_size_message(s.size, s.quantity))
        for s in catalog.size_breakdown(sizes)
    ]
    report = StockReport(
        product_id=row["product_id"],
        name=row["name"],
        price=row["price"],
        checked_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        low_stock_threshold=catalog.LOW_STOCK_THRESHOLD,
        sizes=breakdown,
        total_units=sum(max(q, 0) for q in sizes.values()),
        sizes_in_stock=_in_stock(sizes),
        sizes_sold_out=_sold_out(sizes),
    )

    requested = _normalize_size(size)
    if requested:
        report.requested_size = requested
        if requested not in sizes:
            report.requested_size_status = "not_offered"
            report.nearest_sizes_in_stock = _in_stock(sizes)
        else:
            report.requested_size_status = catalog.stock_status(sizes[requested])
            if sizes[requested] <= 0:
                report.nearest_sizes_in_stock = _nearest_sizes(requested, sizes)
                report.similar_in_stock = _similar_in_size(row, requested)
                ctx.deps.seen_product_ids.update(a.product_id for a in report.similar_in_stock)
    return report


# --------------------------------------------------------------------------- store and customer tools


def get_store_info(ctx: RunContext[ShopDeps], topic: str) -> str:
    """Official store facts. Use this for any question about the company, policies, or visiting us.

    Args:
        topic: One of 'about', 'licensing', 'production', 'shipping', 'returns', 'store', 'contact',
            'sizing', 'account', 'ordering'.
    """
    key = topic.lower().strip()
    if key in STORE_INFO:
        return STORE_INFO[key]
    return "Unknown topic. Available topics: " + ", ".join(STORE_INFO)


GUEST_NOTE = (
    "The customer is browsing as a guest (not signed in). There is no saved profile or chat memory; "
    "signing in or creating an account would let the concierge remember them next time."
)


def recall_past_conversations(ctx: RunContext[ShopDeps], limit: int = 10, about: str | None = None) -> dict[str, Any]:
    """The signed-in customer's own saved chat messages from earlier visits (newest last).

    Use this when a returning customer refers to an earlier conversation ("the hoodie you showed me
    last week"), or to pick up where they left off.

    Args:
        limit: How many messages to return (1-30).
        about: Optional keyword or product name; only messages mentioning it (or showing a product
            whose name contains it) are returned, searched across their whole saved history.
    """
    if not ctx.deps.signed_in:
        return {"signed_in": False, "note": GUEST_NOTE}
    limit = max(1, min(limit, 30))
    rows = customers.load_history(ctx.deps.user_id, 500 if about else limit)
    if about:
        needle = about.lower().strip()
        rows = [
            r for r in rows
            if needle in r["content"].lower() or needle in (r["products_json"] or "").lower()
        ][-limit:]
    messages = []
    for r in rows:
        products = customers.product_ids_of(r["products_json"])
        ctx.deps.seen_product_ids.update(pid for pid in products if product_exists(pid))
        item: dict[str, Any] = {"role": r["role"], "content": r["content"][:600], "at": r["created_at"]}
        if products:
            item["products_shown"] = products
        if r["page_json"]:
            try:
                page = json.loads(r["page_json"])
                item["was_viewing"] = {k: page[k] for k in ("page_type", "product_id", "category", "search") if k in page}
            except json.JSONDecodeError:
                pass
        messages.append(item)
    return {
        "signed_in": True,
        "matching_messages": len(messages),
        "messages": messages,
        "note": "" if messages else "No saved messages match. Say so honestly; do not guess what they discussed.",
    }


def get_customer_profile(ctx: RunContext[ShopDeps]) -> CustomerProfile | dict[str, Any]:
    """The signed-in customer's own account and shopping memory.

    Returns their name, email, member-since date, how much they have chatted and when, sizes they
    asked about before, favorite departments, recently viewed products, and their last questions.
    Use it to personalize: greet by name, default searches to their usual size, suggest from their
    favorite departments, or answer "what's my email on file?".
    """
    if ctx.deps.customer is None:
        return {"signed_in": False, "note": GUEST_NOTE}
    ctx.deps.seen_product_ids.update(v.product_id for v in ctx.deps.customer.recently_viewed)
    return ctx.deps.customer


def _brief(product_id: str) -> ProductBrief | None:
    row, sizes = _get_row(product_id)
    if row is None:
        return None
    summary = catalog.to_summary(row, sizes)
    return ProductBrief(
        product_id=summary.id, name=summary.name, category=summary.category, price=summary.price,
        colors=summary.colors, summary=summary.short_description, sizes_in_stock=_in_stock(sizes),
    )


def build_shopping_context(deps: ShopDeps) -> ShoppingContext:
    """Current page, bag, and recently viewed products, every fact re-read from the database."""
    page = deps.page or PageContext()
    current = CurrentPage(page_type=page.page_type, description="")

    if page.product_id and (product := _brief(page.product_id)):
        current.product = product
        current.description = f"Product page for {product.name} (${product.price:g})"
        _, sizes = _get_row(page.product_id)
        current.stock_line = ", ".join(
            f"{s.size} {'sold out' if s.quantity <= 0 else s.quantity}"
            + (" (low)" if 0 < s.quantity <= catalog.LOW_STOCK_THRESHOLD else "")
            for s in catalog.size_breakdown(sizes)
        )
        if page.selected_size:
            current.selected_size = page.selected_size
            current.selected_size_message = _size_message(page.selected_size, sizes.get(page.selected_size, 0))
    elif page.page_type == "concierge_results":
        current.concierge_headline = page.concierge_headline
        current.concierge_query = page.concierge_query
        current.concierge_product_count = len(page.concierge_product_ids)
        current.concierge_product_ids = page.concierge_product_ids[:12]
        current.description = f"Concierge results page '{page.concierge_headline or 'results'}' with {len(page.concierge_product_ids)} products"
    elif page.page_type == "products":
        current.category, current.search = page.category, page.search
        parts = [page.category or "all departments"]
        if page.search:
            parts.append(f"searching '{page.search}'")
        current.description = "Products catalogue: " + ", ".join(parts)
    else:
        current.description = {
            "home": "Home page", "about": "About Us page", "login": "Log-in page",
            "create_account": "Create-account page",
        }.get(page.page_type, "Browsing the site")

    bag: list[BagItemStatus] = []
    for line in page.bag:
        row, sizes = _get_row(line.product_id)
        if row is None:
            continue
        left = sizes.get(line.size, 0)
        if left <= 0:
            status, note = "sold_out", f"Size {line.size} has sold out since it was added to the bag."
        elif line.quantity > left:
            status, note = "more_than_available", f"Only {left} left in size {line.size}, but {line.quantity} are in the bag."
        elif left <= catalog.LOW_STOCK_THRESHOLD:
            status, note = "low_stock", f"Only {left} left in size {line.size} — worth checking out soon."
        else:
            status, note = "ok", f"In stock in size {line.size}."
        bag.append(BagItemStatus(
            product_id=row["product_id"], name=row["name"], category=catalog.categorize(row["garment_type"]),
            size=line.size, quantity=line.quantity, unit_price=row["price"],
            line_total=round(row["price"] * line.quantity, 2), units_left_in_size=left, status=status, note=note,
        ))

    viewed_ids = list(page.recently_viewed)
    if deps.customer:
        viewed_ids += [v.product_id for v in deps.customer.recently_viewed]
    viewed_ids = [pid for pid in dict.fromkeys(viewed_ids) if pid != page.product_id][:8]
    viewed = [b for pid in viewed_ids if (b := _brief(pid))]

    deps.seen_product_ids.update(
        [*(p.product_id for p in viewed), *(b.product_id for b in bag), *current.concierge_product_ids]
        + ([current.product.product_id] if current.product else [])
    )
    return ShoppingContext(
        signed_in=deps.signed_in,
        current_page=current,
        bag=bag,
        bag_units=sum(b.quantity for b in bag),
        bag_subtotal=round(sum(b.line_total for b in bag), 2),
        recently_viewed=viewed,
        note="Prices and stock are live from the database. Shipping and taxes are calculated at checkout.",
    )


def get_shopping_context(ctx: RunContext[ShopDeps]) -> ShoppingContext:
    """What the customer is looking at and holding right now: the current page (product and selected
    size, catalogue filters, or concierge results), their bag re-checked against live price and stock,
    and recently viewed products. Works for guests and signed-in customers.

    Use it for "this", "my bag", "what I was looking at", "does this go with…", or before suggesting
    something that completes their outfit.
    """
    return build_shopping_context(ctx.deps)


# --------------------------------------------------------------------------- concierge actions and account tools

MAX_ACTION_QUANTITY = 10
# Bag adds plus wishlist saves in one message; more needs a new message from the customer.
MAX_ACTIONS_PER_TURN = 4
TOO_MANY_ACTIONS = ToolError(
    error=f"Limit reached: at most {MAX_ACTIONS_PER_TURN} bag or wishlist actions per message, so nothing more was done.",
    hint="Confirm what was done so far and ask the customer to send the rest in a new message.",
)
SIGN_IN_NOTE = (
    "This needs a signed-in customer. Tell them that logging in (top right) lets you save pieces and look up "
    "their orders; offer to keep helping meanwhile."
)


def add_to_bag(ctx: RunContext[ShopDeps], product: str, size: str, quantity: int = 1) -> dict[str, Any] | ToolError:
    """Put a product in the customer's bag, in a size that is in stock. Works for guests and signed-in customers.

    ONLY call this when the customer explicitly asks you to add something ("add it", "put the M in my bag",
    "I'll take two"). Never add on your own initiative: offer instead. You need a size: use the size they
    named, the size selected on the open product page, or their saved size; if none is known, ask first.
    The website adds the item and shows a confirmation, so after calling this simply confirm what was added.

    Args:
        product: The product_id, or the product's name as the customer wrote it.
        size: XS, S, M, L, XL, or XXL.
        quantity: How many (1-10). Capped at the units left in that size.
    """
    product_id = _resolve(ctx, product)
    if isinstance(product_id, ToolError):
        return product_id
    row, sizes = _get_row(product_id)
    if row is None:
        return _not_found(product_id)
    wanted = _normalize_size(size)
    if wanted is None or wanted not in sizes:
        return ToolError(error=f"{row['name']} is not offered in size {size}.", hint=f"Offered sizes: {', '.join(s for s in catalog.SIZE_ORDER if s in sizes)}. Ask which one they want.")
    left = sizes[wanted]
    if left <= 0:
        return ToolError(
            error=f"{row['name']} is sold out in {wanted}, so nothing was added.",
            hint=f"In stock: {', '.join(_in_stock(sizes)) or 'no sizes'}. Offer a neighboring size or a similar piece.",
        )
    in_bag = sum(line.quantity for line in (ctx.deps.page.bag if ctx.deps.page else []) if line.product_id == product_id and line.size == wanted)
    room = max(0, left - in_bag)
    if room == 0:
        return ToolError(error=f"The bag already holds all {left} units left in {wanted}.", hint="Tell the customer; nothing more can be added in that size.")
    qty = max(1, min(quantity, MAX_ACTION_QUANTITY, room))
    others = [a for a in ctx.deps.actions if not (a.type == "add_to_bag" and a.product_id == product_id and a.size == wanted)]
    if len(others) >= MAX_ACTIONS_PER_TURN:
        return TOO_MANY_ACTIONS
    ctx.deps.actions = others
    ctx.deps.seen_product_ids.add(product_id)
    ctx.deps.actions.append(ChatAction(
        type="add_to_bag", product_id=product_id, name=row["name"], price=row["price"],
        image_url=catalog.image_url(row["image_file_path"]), size=wanted, quantity=qty, max_quantity=left,
    ))
    note = f"Added {qty} x {row['name']} in {wanted} (${row['price']:g} each)."
    if qty < quantity:
        note += f" Only {qty} could be added: {left} left in {wanted}{f', {in_bag} already in the bag' if in_bag else ''}."
    if left <= catalog.LOW_STOCK_THRESHOLD:
        note += f" Only {left} left in this size."
    return {"added": True, "product_id": product_id, "size": wanted, "quantity": qty, "note": note,
            "next": "Confirm briefly. The Checkout button is in their bag (top right)."}


def save_to_wishlist(ctx: RunContext[ShopDeps], product: str, size: str | None = None) -> dict[str, Any] | ToolError:
    """Save a product to the signed-in customer's wishlist (their "save for later" list in My Account).

    Call this when the customer asks to save, remember, favorite, or wishlist a piece, or wants to decide
    later. The wishlist shows live stock for the saved size, so saving the size they care about helps.

    Args:
        product: The product_id, or the product's name as the customer wrote it.
        size: Optional size to remember with it.
    """
    if not ctx.deps.signed_in:
        return {"saved": False, "signed_in": False, "note": SIGN_IN_NOTE}
    product_id = _resolve(ctx, product)
    if isinstance(product_id, ToolError):
        return product_id
    row, sizes = _get_row(product_id)
    if row is None:
        return _not_found(product_id)
    wanted = _normalize_size(size)
    if wanted and wanted not in sizes:
        wanted = None
    if len(ctx.deps.actions) >= MAX_ACTIONS_PER_TURN:
        return TOO_MANY_ACTIONS
    account.add_to_wishlist(ctx.deps.user_id, product_id, wanted)  # type: ignore[arg-type]
    ctx.deps.seen_product_ids.add(product_id)
    ctx.deps.actions.append(ChatAction(
        type="save_to_wishlist", product_id=product_id, name=row["name"], price=row["price"],
        image_url=catalog.image_url(row["image_file_path"]), size=wanted, quantity=1,
        max_quantity=sizes.get(wanted) if wanted else None,
    ))
    return {"saved": True, "product_id": product_id, "size": wanted, "note": f"Saved {row['name']}{f' in {wanted}' if wanted else ''} to their wishlist in My Account."}


def get_my_wishlist(ctx: RunContext[ShopDeps]) -> dict[str, Any]:
    """The signed-in customer's saved pieces, newest first, with price and live stock of the saved size.

    Use for "what did I save?", "is my saved hoodie still in stock?", or to suggest something they wanted.
    """
    if not ctx.deps.signed_in:
        return {"signed_in": False, "note": SIGN_IN_NOTE}
    items = account.wishlist_for_agent(ctx.deps.user_id)  # type: ignore[arg-type]
    ctx.deps.seen_product_ids.update(i["product_id"] for i in items)
    return {"signed_in": True, "count": len(items), "items": items}


def get_my_orders(ctx: RunContext[ShopDeps]) -> dict[str, Any]:
    """The signed-in customer's recent orders: order number, date, status, pickup or shipping, the
    estimated ready/ship date, items, and total.

    Use for "where is my order?", "when will it ship?", or "what did I order last time?". You can report
    status and dates; you cannot change, cancel, or refund an order (point to orderdept@campuscustoms.com).
    """
    if not ctx.deps.signed_in:
        return {"signed_in": False, "note": SIGN_IN_NOTE + " Guests can find their order number in the confirmation email."}
    orders = account.order_summary_for_agent(ctx.deps.user_id)  # type: ignore[arg-type]
    return {
        "signed_in": True,
        "orders": orders,
        "policy": "Most orders are printed in New Haven and ship or are ready for pickup within 8-10 business days.",
        "note": "" if orders else "No orders on this account yet.",
    }


def store_facts() -> str:
    """The store facts as a static instructions block: in the (cached) prompt, no tool round trip needed."""
    lines = ["## Store facts (official; the only source for company, policy, and visiting questions)"]
    lines += [f"- **{topic}**: {text}" for topic, text in STORE_INFO.items()]
    lines.append("\n## Departments (from the catalogue when the agent started; use search_products for actual products)")
    for d in list_categories(None):  # type: ignore[arg-type]
        lines.append(f"- {d.category}: {d.products} styles, ${d.price_from:g}–${d.price_to:g}")
    return "\n".join(lines)


def _once_per_turn(tool: Callable[..., Any]) -> Callable[..., Any]:
    """Answer a repeated identical call from memory instead of letting the model loop on it.
    The model sometimes re-checks the same stock or search several times; each repeat costs a full
    model round trip (2-3 s), so the repeat gets the earlier result plus a nudge to answer."""

    @functools.wraps(tool)
    def wrapper(ctx: RunContext[ShopDeps], *args: Any, **kwargs: Any) -> Any:
        key = f"{tool.__name__}:{json.dumps([args, kwargs], sort_keys=True, default=str)}"
        if key in ctx.deps.tool_results:
            return {
                "duplicate_call": True,
                "note": "You already called this tool with these exact arguments in this turn. "
                "Here is the same result again: use it and give the customer your answer now.",
                "result": ctx.deps.tool_results[key],
            }
        result = tool(ctx, *args, **kwargs)
        ctx.deps.tool_results[key] = result
        return result

    return wrapper


AGENT_TOOLS = [
    _once_per_turn(t)
    for t in (
        search_products,
        find_product,
        list_categories,
        get_product_info,
        get_price,
        get_stock_by_size,
        get_customer_profile,
        get_shopping_context,
        recall_past_conversations,
        get_my_wishlist,
        get_my_orders,
        add_to_bag,
        save_to_wishlist,
    )
]
