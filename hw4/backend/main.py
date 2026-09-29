"""Campus Customs API.

Serves the product catalogue, per-size stock, and product images from
data/campus_customs.db to the React storefront, handles customer accounts,
and answers the chat widget through the PydanticAI agent in agent.py.

Run from the backend/ folder:
    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import json
import logging
import re
import sqlite3
import threading
import time
import uuid
from collections import defaultdict
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from fastapi import Cookie, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from PIL import Image, ImageChops, ImageDraw, ImageFilter
from pydantic import BaseModel, Field, field_validator
from pydantic_ai import capture_run_messages
from pydantic_ai.exceptions import ModelHTTPError, UnexpectedModelBehavior, UsageLimitExceeded
from pydantic_ai.messages import ModelMessage

import account
import agent
import audit
import auth
import customers
import tools
from catalog import (
    CATEGORY_ORDER,
    IMAGES_DIR,
    CategoryCount,
    ProductDetail,
    ProductSummary,
    all_summaries,
    connect,
    connect_rw,
    is_stub,
    load_stock,
    parse_list,
    size_breakdown,
    to_summary,
)
from models import ChatPage, ChatReply, ChatRequest, ChatResponse, PageUpdate, ProductCard, SavedMessage, ShopDeps

log = logging.getLogger("campus_customs")

IMAGE_CACHE_DIR = Path(__file__).resolve().parent / ".image_cache"


# --------------------------------------------------------------------------- images


def whiten_background(src: Path, dst: Path) -> None:
    """Many product JPGs were exported from transparent PNGs, leaving a black
    backdrop. Flood-fill near-black regions connected to the border with white
    so every product sits on the same clean studio background."""
    im = Image.open(src).convert("RGB")
    w, h = im.size
    r, g, b = im.split()

    # Candidate background: near-black AND neutral. Navy fabric is dark but
    # clearly blue-tinted, so the (blue - red) test keeps the fill out of it.
    brightest = ImageChops.lighter(ImageChops.lighter(r, g), b)
    dark = brightest.point(lambda v: 255 if v <= 18 else 0)
    neutral = ImageChops.subtract(b, r).point(lambda v: 255 if v < 10 else 0)
    candidate = ImageChops.multiply(dark, neutral)

    cpx = candidate.load()
    edge = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + \
           [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
    for x, y in edge:
        if cpx[x, y] == 255:
            ImageDraw.floodfill(candidate, (x, y), 128, thresh=0)

    background = candidate.point(lambda v: 255 if v == 128 else 0)
    if background.getbbox():
        im.paste((255, 255, 255), mask=background.filter(ImageFilter.MaxFilter(5)))
    dst.parent.mkdir(parents=True, exist_ok=True)
    # Write to a temp file and swap it in, so a request never reads a half-written image.
    tmp = dst.with_name(f"{dst.stem}.{uuid.uuid4().hex}.tmp")
    im.save(tmp, "JPEG", quality=92)
    tmp.replace(dst)


_image_lock = threading.Lock()


def cached_image(filename: str) -> Path:
    src = IMAGES_DIR / filename
    cached = IMAGE_CACHE_DIR / filename
    with _image_lock:
        if not cached.exists() or cached.stat().st_mtime < src.stat().st_mtime:
            whiten_background(src, cached)
    return cached


def prewarm_images() -> None:
    for src in sorted(IMAGES_DIR.glob("*.jpg")):
        try:
            cached_image(src.name)
        except OSError:
            pass


# --------------------------------------------------------------------------- app


@asynccontextmanager
async def lifespan(_: FastAPI):
    customers.ensure_schema()
    account.ensure_schema()
    try:
        agent.get_agent()  # build the agent and its HTTP client now, not on the first customer's message
    except RuntimeError as exc:
        log.warning("Chat is unavailable until an API key is set: %s", exc)
    threading.Thread(target=prewarm_images, daemon=True).start()
    yield


app = FastAPI(title="Campus Customs API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
app.include_router(account.router)


@app.get("/images/{filename}")
def product_image(filename: str) -> FileResponse:
    src = (IMAGES_DIR / filename).resolve()
    if src.parent != IMAGES_DIR.resolve() or not src.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(cached_image(filename), media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/api/health")
def health() -> dict[str, str | int]:
    with connect() as conn:
        count = conn.execute("SELECT COUNT(*) FROM catalogue").fetchone()[0]
    return {"status": "ok", "products": count}


@app.get("/api/products", response_model=list[ProductSummary])
def list_products(
    q: str | None = Query(None, description="Free-text search over name, description, colors and tags"),
    category: str | None = Query(None),
    sort: Literal["featured", "price_asc", "price_desc", "name"] = "featured",
    limit: int | None = Query(None, ge=1, le=200),
) -> list[ProductSummary]:
    products = all_summaries()

    if category:
        products = [p for p in products if p.category.lower() == category.lower()]

    if q:
        terms = [t for t in re.split(r"\s+", q.lower().strip()) if t]
        with connect() as conn:
            haystack = {
                r["product_id"]: " ".join([r["name"], r["garment_type"], r["description"], r["colors"], r["search_tags"]]).lower()
                for r in conn.execute("SELECT * FROM catalogue")
            }
        products = [p for p in products if all(t in haystack[p.id] for t in terms)]

    if sort == "price_asc":
        products.sort(key=lambda p: (p.price, p.name))
    elif sort == "price_desc":
        products.sort(key=lambda p: (-p.price, p.name))
    elif sort == "featured":
        products.sort(key=lambda p: (is_stub_summary(p), -p.sizes_available, p.name))

    return products[:limit] if limit else products


def is_stub_summary(p: ProductSummary) -> bool:
    return not p.colors


@app.get("/api/categories", response_model=list[CategoryCount])
def list_categories() -> list[CategoryCount]:
    products = all_summaries()
    result = []
    for name in CATEGORY_ORDER:
        members = [p for p in products if p.category == name]
        cover = next((p for p in members if p.colors), None)
        if cover:
            result.append(CategoryCount(name=name, count=len(members), image_url=cover.image_url))
    return result


@app.get("/api/products/{product_id}", response_model=ProductDetail)
def get_product(product_id: str) -> ProductDetail:
    with connect() as conn:
        row = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (product_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Product not found")
        stock = load_stock(conn)

    sizes = stock.get(product_id, {})
    summary = to_summary(row, sizes)
    description = summary.short_description if is_stub(row["description"]) else row["description"]

    related = [
        p for p in all_summaries()
        if p.category == summary.category and p.id != product_id and p.colors
    ][:4]

    return ProductDetail(
        **summary.model_dump(),
        description=description,
        search_tags=parse_list(row["search_tags"]),
        sizes=size_breakdown(sizes),
        related=related,
    )


# ==========================================================================
#  Authentication — account creation, login, session
# ==========================================================================

SESSION_COOKIE = "cc_session"
SESSION_DAYS = 30
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD_LEN = 8

# Simple in-memory throttle: cap failed logins per email to blunt brute force.
_LOGIN_WINDOW_SEC = 15 * 60
_LOGIN_MAX_FAILS = 8
_login_fails: dict[str, list[float]] = defaultdict(list)


class RegisterRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=MIN_PASSWORD_LEN, max_length=200)
    confirm_password: str

    @field_validator("first_name", "last_name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be blank")
        return v

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Please enter a valid email address")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


class PublicUser(BaseModel):
    id: int
    first_name: str | None
    last_name: str | None
    name: str
    email: str
    preferred_size: str | None = None


def public_user(row: sqlite3.Row) -> PublicUser:
    return PublicUser(
        id=row["id"],
        first_name=row["first_name"],
        last_name=row["last_name"],
        name=row["name"],
        email=row["email"],
        preferred_size=row["preferred_size"] if "preferred_size" in row.keys() else None,
    )


def set_session_cookie(response: Response, user_id: int) -> None:
    token = auth.make_session_token(user_id, auth.get_secret(), SESSION_DAYS)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_DAYS * 86_400,
        httponly=True,       # not readable from JavaScript → mitigates XSS token theft
        samesite="lax",      # not sent on cross-site POSTs → mitigates CSRF
        secure=False,        # dev over http://localhost; set True behind HTTPS in production
        path="/",
    )


def current_user_row(token: str | None) -> sqlite3.Row | None:
    if not token:
        return None
    user_id = auth.read_session_token(token, auth.get_secret())
    if user_id is None:
        return None
    with connect() as conn:
        return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def _record_failure(email: str) -> None:
    now = time.time()
    fails = [t for t in _login_fails[email] if now - t < _LOGIN_WINDOW_SEC]
    fails.append(now)
    _login_fails[email] = fails


def _too_many_failures(email: str) -> bool:
    now = time.time()
    fails = [t for t in _login_fails[email] if now - t < _LOGIN_WINDOW_SEC]
    _login_fails[email] = fails
    return len(fails) >= _LOGIN_MAX_FAILS


@app.post("/api/auth/register", response_model=PublicUser, status_code=201)
def register(body: RegisterRequest, response: Response) -> PublicUser:
    if body.password != body.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    full_name = f"{body.first_name} {body.last_name}"
    password_hash = auth.hash_password(body.password)

    with connect_rw() as conn:
        exists = conn.execute("SELECT 1 FROM users WHERE email = ?", (body.email,)).fetchone()
        if exists:
            raise HTTPException(status_code=409, detail="An account with this email already exists")
        cur = conn.execute(
            "INSERT INTO users (name, email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?)",
            (full_name, body.email, password_hash, body.first_name, body.last_name),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()

    set_session_cookie(response, row["id"])
    return public_user(row)


@app.post("/api/auth/login", response_model=PublicUser)
def login(body: LoginRequest, response: Response) -> PublicUser:
    email = body.email.strip().lower()

    if _too_many_failures(email):
        raise HTTPException(status_code=429, detail="Too many attempts. Please wait a few minutes and try again.")

    with connect_rw() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        # Always run a verification to keep timing uniform whether or not the email exists.
        stored = row["password_hash"] if row else auth.hash_password("timing-equalizer")
        ok = auth.verify_password(body.password, stored)

        if not row or not ok:
            _record_failure(email)
            raise HTTPException(status_code=401, detail="Invalid email or password")

        # Transparent upgrade: rehash legacy/weaker hashes on successful login.
        if auth.needs_rehash(stored):
            conn.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                (auth.hash_password(body.password), row["id"]),
            )
            conn.commit()

    _login_fails.pop(email, None)
    set_session_cookie(response, row["id"])
    return public_user(row)


@app.post("/api/auth/logout", status_code=204)
def logout(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")


@app.get("/api/auth/me", response_model=PublicUser | None)
def me(cc_session: str | None = Cookie(default=None)) -> PublicUser | None:
    row = current_user_row(cc_session)
    return public_user(row) if row else None


# ==========================================================================
#  Chat — the Bulldog Blue Concierge (PydanticAI agent)
# ==========================================================================

CHAT_WINDOW_SEC = 5 * 60
CHAT_MAX_MESSAGES = 20
_chat_hits: dict[str, list[float]] = defaultdict(list)

STORE_EMAIL = "orderdept@campuscustoms.com"
EMAIL_IN_TEXT = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
FALLBACK_REPLY = (
    "I'm sorry — I'm having trouble reaching our shelves right now. Please try again in a moment, "
    f"or email {STORE_EMAIL} and our team will be glad to help."
)
REFUSAL = ChatResponse(
    reply=(
        "That's not something I can help with — but I'd love to help you find the perfect piece of Yale apparel. "
        "Are you shopping for yourself or looking for a gift?"
    ),
    suggestions=["Show me hoodies", "Gift ideas under $60", "Residential college crewnecks"],
)
INJECTION_PATTERNS = re.compile(
    r"(ignore|disregard|forget|override) (all |any )?(of )?(the |your )?(previous|prior|above|earlier|your) (instructions|rules|prompt|guidelines)"
    r"|(reveal|print|show|repeat|output|dump|leak).{0,30}(system prompt|your instructions|your prompt|your rules|your tools)"
    r"|\b(system|developer) prompt\b|developer mode|debug mode|god mode|jailbreak|\bDAN\b|password_hash|\bsqlite_master\b",
    re.IGNORECASE,
)
PROVIDER_SAFETY_CODES = {"content_filter", "cyber_policy"}
# A payment-card-like number (13-19 digits, spaces or dashes allowed) never reaches the model,
# the chat history, or the audit trail.
CARD_IN_TEXT = re.compile(r"\b(?:\d[ -]?){12,18}\d\b")
CARD_NOTE = "[card number removed]"
# The concierge never sends links: product cards and the results page carry the only URLs.
LINK_IN_TEXT = re.compile(r"(?:https?://|www\.)\S+", re.IGNORECASE)


def _chat_rate_limited(key: str) -> bool:
    now = time.time()
    hits = [t for t in _chat_hits[key] if now - t < CHAT_WINDOW_SEC]
    hits.append(now)
    _chat_hits[key] = hits
    return len(hits) > CHAT_MAX_MESSAGES


def _redact_emails(text: str, own_email: str | None = None) -> str:
    """Last line of defence: no email address leaves the chat except the shop's own and,
    for a signed-in customer, their own address on file."""
    allowed = {STORE_EMAIL, (own_email or "").lower()}
    return EMAIL_IN_TEXT.sub(lambda m: m.group(0) if m.group(0).lower() in allowed else "[email hidden]", text)


def _clean_reply(text: str, own_email: str | None = None) -> str:
    """Everything the concierge writes passes here: no foreign emails, no links, no card numbers."""
    text = LINK_IN_TEXT.sub("[link removed]", text)
    return CARD_IN_TEXT.sub(CARD_NOTE, _redact_emails(text, own_email))


def _cards(product_ids: list[str]) -> list[ProductCard]:
    return [card for pid in product_ids if (card := tools.product_card(pid))]


def _page(update: PageUpdate | None, query: str) -> ChatPage | None:
    """Turn the agent's page request into the same ProductSummary objects GET /api/products returns."""
    if update is None:
        return None
    by_id = {p.id: p for p in all_summaries()}
    products = [by_id[pid] for pid in update.product_ids if pid in by_id]
    if not products:
        return None
    return ChatPage(
        id=uuid.uuid4().hex[:12],
        headline=_clean_reply(update.headline.strip()),
        intro=_clean_reply(update.intro.strip()),
        query=query,
        products=products,
    )


USAGE_LIMIT_REPLY = ChatResponse(
    reply="That one needs a closer look than I can give in chat. Could you narrow it down — a garment, color, or college?",
    suggestions=["Show me hoodies", "Crewnecks under $60", "Gift ideas"],
)


@dataclass
class ChatTurn:
    """Everything one chat message needs, prepared the same way for the plain and streaming endpoints."""

    message: str
    user: sqlite3.Row | None
    deps: ShopDeps
    refusal: ChatResponse | None = None
    history_turns: int = 0
    run_id: str = field(default_factory=audit.new_run_id)
    started_at: str = field(default_factory=audit.now)
    started: float = field(default_factory=time.perf_counter)


def _page_label(page: object | None) -> str:
    if page is None:
        return "unknown"
    product = getattr(page, "product_id", None)
    return f"{page.page_type}:{product}" if product else page.page_type  # type: ignore[attr-defined]


def _audit_turn(
    turn: ChatTurn,
    endpoint: str,
    messages: list[ModelMessage],
    stop_reason: str,
    detail: str = "",
    response: ChatResponse | None = None,
) -> None:
    """Write one run to output/audit_trail.json: start, every model step and tool call, and why it stopped."""
    steps, totals = audit.run_entries(turn.run_id, messages)
    start = {
        "time": turn.started_at, "run_id": turn.run_id, "event": "run_start", "endpoint": endpoint,
        "customer": "signed_in" if turn.user else "guest", "page": _page_label(turn.deps.page),
        "history_turns": turn.history_turns, "message": audit.short(turn.message, 120),
    }
    end = {
        "time": audit.now(), "run_id": turn.run_id, "event": "run_end", "stop_reason": stop_reason,
        "detail": audit.short(detail) if detail else "", **totals,
        "duration_ms": round((time.perf_counter() - turn.started) * 1000),
        "reply": audit.short(response.reply, 120) if response else "",
        "product_cards": len(response.products) if response else 0,
        "results_page_products": len(response.page.products) if response and response.page else 0,
        "actions": [f"{a.type} {a.product_id} {a.size or ''} x{a.quantity}".replace("  ", " ") for a in response.actions] if response else [],
    }
    audit.append([start, *steps, end])


def _stop_reason(exc: BaseException) -> tuple[str, str]:
    if isinstance(exc, UsageLimitExceeded):
        return "usage_limit", str(exc)
    if isinstance(exc, ModelHTTPError):
        body_info = exc.body if isinstance(exc.body, dict) else {}
        if body_info.get("code") in PROVIDER_SAFETY_CODES or "content management policy" in str(exc.body):
            return "provider_safety_refusal", f"HTTP {exc.status_code}"
        return "model_error", f"HTTP {exc.status_code}"
    if isinstance(exc, UnexpectedModelBehavior):
        return "retries_exhausted", str(exc)
    return "error", type(exc).__name__


def _prepare_turn(body: ChatRequest, request: Request, cc_session: str | None, endpoint: str) -> ChatTurn:
    user = current_user_row(cc_session)
    client_key = f"user:{user['id']}" if user else f"ip:{request.client.host if request.client else 'unknown'}"
    message = CARD_IN_TEXT.sub(CARD_NOTE, body.message.strip())
    if _chat_rate_limited(client_key):
        _audit_turn(ChatTurn(message, user, ShopDeps(), history_turns=len(body.history)), endpoint, [], "rate_limited",
                    f"more than {CHAT_MAX_MESSAGES} messages in {CHAT_WINDOW_SEC // 60} minutes")
        raise HTTPException(status_code=429, detail="You're sending messages quickly — please wait a moment and try again.")

    if not message:
        raise HTTPException(status_code=422, detail="Message cannot be empty")
    if INJECTION_PATTERNS.search(message):
        return ChatTurn(message, user, ShopDeps(), refusal=REFUSAL, history_turns=len(body.history))

    # Who is asking comes only from the signed session cookie; what they are viewing comes from
    # the browser and is checked against the catalogue before the agent sees it.
    page = customers.clean_page_context(body.page_context)
    if page:
        for field_name in ("search", "concierge_query", "concierge_headline"):
            if INJECTION_PATTERNS.search(getattr(page, field_name) or ""):
                setattr(page, field_name, None)
    profile = customers.load_profile(user) if user else None
    deps = ShopDeps(
        user_id=user["id"] if user else None,
        first_name=profile.first_name if profile else None,
        customer=profile,
        page=page,
    )
    return ChatTurn(message, user, deps, history_turns=len(body.history))


def _failure_response(exc: Exception) -> ChatResponse:
    if isinstance(exc, ModelHTTPError):
        body_info = exc.body if isinstance(exc.body, dict) else {}
        if body_info.get("code") in PROVIDER_SAFETY_CODES or "content management policy" in str(exc.body):
            return REFUSAL
        log.error("Chat model request failed: %s", exc)
        return ChatResponse(reply=FALLBACK_REPLY)
    if isinstance(exc, UsageLimitExceeded):
        log.warning("Chat run hit its usage limit")
        return USAGE_LIMIT_REPLY
    log.exception("Chat agent failed", exc_info=exc)
    return ChatResponse(reply=FALLBACK_REPLY)


def _finish_turn(turn: ChatTurn, output: ChatReply) -> ChatResponse:
    own_email = turn.deps.customer.email if turn.deps.customer else None
    response = ChatResponse(
        reply=_clean_reply(output.reply.strip(), own_email),
        products=_cards(output.product_ids),
        suggestions=[_clean_reply(s.strip()) for s in output.suggestions if s.strip()][:3],
        page=_page(output.page, turn.message),
        actions=turn.deps.actions,
    )
    if turn.user:
        try:
            customers.save_turns(turn.user["id"], turn.message, response.reply, [p.id for p in response.products], turn.deps.page)
        except sqlite3.Error:
            log.exception("Could not save chat turns")
    return response


@app.post("/api/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, request: Request, cc_session: str | None = Cookie(default=None)) -> ChatResponse:
    turn = _prepare_turn(body, request, cc_session, "chat")
    if turn.refusal:
        _audit_turn(turn, "chat", [], "blocked_by_input_guard", "matched a prompt-injection pattern", turn.refusal)
        return turn.refusal
    with capture_run_messages() as messages:
        try:
            output = await agent.run_chat(turn.message, body.history, turn.deps)
        except Exception as exc:  # noqa: BLE001 - every failure becomes a polite reply
            response = _failure_response(exc)
            _audit_turn(turn, "chat", messages, *_stop_reason(exc), response)
            return response
    response = _finish_turn(turn, output)
    _audit_turn(turn, "chat", messages, "final_answer", "", response)
    return response


@app.post("/api/chat/stream")
async def chat_stream(body: ChatRequest, request: Request, cc_session: str | None = Cookie(default=None)) -> StreamingResponse:
    """The same turn as POST /api/chat, streamed as NDJSON lines:
    {"type":"status","text":…} while tools run, {"type":"reply","text":…} as the answer is written,
    and one final {"type":"done","response":ChatResponse}."""
    turn = _prepare_turn(body, request, cc_session, "chat/stream")
    own_email = turn.deps.customer.email if turn.deps.customer else None

    def line(payload: dict) -> bytes:
        return (json.dumps(payload, ensure_ascii=False) + "\n").encode()

    async def events() -> AsyncIterator[bytes]:
        if turn.refusal:
            _audit_turn(turn, "chat/stream", [], "blocked_by_input_guard", "matched a prompt-injection pattern", turn.refusal)
            yield line({"type": "done", "response": turn.refusal.model_dump()})
            return
        stop, detail, response = "client_disconnected", "the browser closed the stream before the answer finished", None
        with capture_run_messages() as messages:
            try:
                async for kind, value in agent.stream_chat(turn.message, body.history, turn.deps):
                    if kind == "status":
                        yield line({"type": "status", "text": value})
                    elif kind == "reply":
                        yield line({"type": "reply", "text": _clean_reply(value, own_email)})
                    elif kind == "done":
                        response = _finish_turn(turn, value)
                        stop, detail = "final_answer", ""
                        yield line({"type": "done", "response": response.model_dump()})
                        return
            except Exception as exc:  # noqa: BLE001 - every failure becomes a polite reply
                response = _failure_response(exc)
                stop, detail = _stop_reason(exc)
                yield line({"type": "done", "response": response.model_dump()})
            finally:
                _audit_turn(turn, "chat/stream", messages, stop, detail, response)

    return StreamingResponse(events(), media_type="application/x-ndjson", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/api/chat/history", response_model=list[SavedMessage])
def chat_history(limit: int = Query(20, ge=1, le=100), cc_session: str | None = Cookie(default=None)) -> list[SavedMessage]:
    user = current_user_row(cc_session)
    if not user:
        return []
    return [
        SavedMessage(
            id=r["id"], role=r["role"], content=r["content"],
            products=_cards(customers.product_ids_of(r["products_json"])[:4]), created_at=r["created_at"],
        )
        for r in customers.load_history(user["id"], limit)
    ]


class ProductViewRequest(BaseModel):
    product_id: str = Field(min_length=1, max_length=120)


@app.post("/api/me/views", status_code=204)
def record_product_view(body: ProductViewRequest, cc_session: str | None = Cookie(default=None)) -> None:
    """Remember which products a signed-in customer opens. Guests: accepted, but nothing is stored."""
    user = current_user_row(cc_session)
    if user:
        customers.record_view(user["id"], body.product_id)
