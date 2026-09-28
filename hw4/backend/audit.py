"""Append-only audit trail of the agent loop: output/audit_trail.json.

Every chat message becomes a few entries sharing one `run_id`:
  run_start  — when, which endpoint, guest or signed in, which page, the (redacted) message
  model_step — one per model request: why the model stopped (`finish_reason`) and which tools it asked for
  tool_call  — one per tool the agent ran: tool name, short args, short result, outcome
  retry      — a tool or output validator sent the model back to fix something
  run_end    — the stop reason for the whole run, with steps, tool calls, tokens, and duration

The file is a JSON array that is only ever appended to: a new batch overwrites the closing
bracket and adds its entries after the existing ones, so earlier entries are never rewritten
and the file stays valid JSON between runs and server restarts. Nothing here can break a chat:
if the file cannot be written, the error is logged and the customer still gets their answer.
"""

from __future__ import annotations

import json
import logging
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pydantic import BaseModel
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    RetryPromptPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)

from models import (
    PriceLookup,
    ProductInfo,
    SearchResults,
    ShoppingContext,
    StockReport,
    ToolError,
)

log = logging.getLogger("campus_customs.audit")

AUDIT_PATH = Path(__file__).resolve().parent.parent / "output" / "audit_trail.json"
MAX_TEXT = 160
STORE_EMAIL = "orderdept@campuscustoms.com"

_lock = threading.Lock()
_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_CARD = re.compile(r"\b(?:\d[ -]?){13,19}\b")


def new_run_id() -> str:
    return uuid.uuid4().hex[:12]


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def _iso(ts: datetime | None) -> str:
    return ts.astimezone(timezone.utc).isoformat(timespec="milliseconds") if ts else now()


def short(value: Any, limit: int = MAX_TEXT) -> str:
    """One line, no email addresses or card-like numbers, at most `limit` characters."""
    if isinstance(value, BaseModel):
        value = value.model_dump(mode="json")
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, default=str)
    text = " ".join(text.split())
    text = _EMAIL.sub(lambda m: m.group(0) if m.group(0).lower() == STORE_EMAIL else "[email]", text)
    text = _CARD.sub("[number hidden]", text)
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _ids(ids: list[str], keep: int = 4) -> str:
    more = f" (+{len(ids) - keep})" if len(ids) > keep else ""
    return ", ".join(ids[:keep]) + more


def summarize_result(tool: str, content: Any) -> tuple[str, str]:
    """(outcome, short result) for one tool return. Customer tools are summarised by counts only,
    so the trail never holds a customer's profile, chat history, or orders."""
    if isinstance(content, dict) and content.get("duplicate_call"):
        return "duplicate", "repeat of an identical call this turn; earlier result reused"
    if isinstance(content, ToolError):
        return "error", short(f"error: {content.error}")
    if isinstance(content, SearchResults):
        return "ok", short(f"{content.match_count} matches: {_ids([r.product_id for r in content.results])}")
    if isinstance(content, StockReport):
        sizes = ", ".join(f"{s.size} {s.quantity}" for s in content.sizes)
        asked = f"; {content.requested_size} → {content.requested_size_status}" if content.requested_size else ""
        return "ok", short(f"{content.product_id} ${content.price:g}: {sizes}{asked}")
    if isinstance(content, ProductInfo):
        return "ok", short(f"{content.product_id} ${content.price:g}, in stock: {', '.join(content.sizes_in_stock) or 'none'}")
    if isinstance(content, PriceLookup):
        quotes = ", ".join(f"{q.product_id} {q.display}" for q in content.quotes)
        missing = f"; not found: {', '.join(content.not_found)}" if content.not_found else ""
        return "ok", short(quotes + missing)
    if isinstance(content, ShoppingContext):
        return "ok", short(f"page: {content.current_page.page_type}; bag: {len(content.bag)} line(s), ${content.bag_subtotal:g}")
    if tool == "get_customer_profile":
        return "ok", "signed-in customer's own profile" if isinstance(content, BaseModel) else "guest: no profile"
    if isinstance(content, dict):
        if content.get("signed_in") is False:
            return "ok", "guest: needs sign-in, nothing returned"
        if tool == "recall_past_conversations":
            return "ok", f"{content.get('matching_messages', 0)} saved message(s)"
        if tool == "get_my_orders":
            return "ok", f"{len(content.get('orders', []))} order(s)"
        if tool == "get_my_wishlist":
            return "ok", f"{content.get('count', 0)} saved piece(s)"
        if "note" in content:
            return "ok", short(content["note"])
    if isinstance(content, list):
        return "ok", short(f"{len(content)} item(s): " + short(content, 120))
    return "ok", short(content)


def _first_new(messages: list[ModelMessage]) -> int:
    """Index of this run's own prompt: the last request that carries a user prompt (earlier ones are history)."""
    for i in range(len(messages) - 1, -1, -1):
        m = messages[i]
        if isinstance(m, ModelRequest) and any(isinstance(p, UserPromptPart) for p in m.parts):
            return i
    return 0


def run_entries(run_id: str, messages: list[ModelMessage]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """model_step, tool_call, and retry entries for the messages this run added (history excluded)."""
    first_new = _first_new(messages)
    entries: list[dict[str, Any]] = []
    calls: dict[str, tuple[int, ToolCallPart]] = {}
    totals = {"steps": 0, "tool_calls": 0, "input_tokens": 0, "output_tokens": 0}
    for message in messages[first_new:]:
        if isinstance(message, ModelResponse):
            totals["steps"] += 1
            totals["input_tokens"] += message.usage.input_tokens or 0
            totals["output_tokens"] += message.usage.output_tokens or 0
            requested = [p for p in message.parts if isinstance(p, ToolCallPart)]
            for part in requested:
                calls[part.tool_call_id] = (totals["steps"], part)
            entries.append({
                "time": _iso(message.timestamp), "run_id": run_id, "event": "model_step", "step": totals["steps"],
                "finish_reason": message.finish_reason or "unknown",
                "tools_requested": [p.tool_name for p in requested],
                "input_tokens": message.usage.input_tokens, "output_tokens": message.usage.output_tokens,
            })
        elif isinstance(message, ModelRequest):
            for part in message.parts:
                if isinstance(part, ToolReturnPart):
                    step, call = calls.get(part.tool_call_id, (totals["steps"], None))
                    outcome, result = summarize_result(part.tool_name, part.content)
                    totals["tool_calls"] += 1
                    entries.append({
                        "time": _iso(part.timestamp), "run_id": run_id, "event": "tool_call", "step": step,
                        "tool": part.tool_name, "args": short(call.args_as_dict() if call else {}),
                        "result": result, "outcome": outcome,
                    })
                elif isinstance(part, RetryPromptPart):
                    step, call = calls.get(part.tool_call_id or "", (totals["steps"], None))
                    entries.append({
                        "time": _iso(part.timestamp), "run_id": run_id, "event": "retry", "step": step,
                        "tool": part.tool_name or "output_validator",
                        "args": short(call.args_as_dict()) if call else None,
                        "result": short(part.content if isinstance(part.content, str) else part.model_response()),
                        "outcome": "sent back to the model to fix",
                    })
    return entries, totals


def append(entries: list[dict[str, Any]]) -> None:
    """Append entries to the JSON array on disk without rewriting what is already there."""
    if not entries:
        return
    block = ",\n".join(json.dumps(e, ensure_ascii=False) for e in entries).encode("utf-8")
    with _lock:
        try:
            AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
            if not AUDIT_PATH.exists() or AUDIT_PATH.stat().st_size == 0:
                AUDIT_PATH.write_bytes(b"[\n" + block + b"\n]\n")
                return
            with AUDIT_PATH.open("r+b") as f:
                f.seek(0, 2)
                end = f.tell()
                back = min(end, 256)
                f.seek(end - back)
                tail = f.read(back)
                bracket = tail.rfind(b"]")
                if bracket == -1:
                    log.error("audit_trail.json does not end with ']'; not appending so nothing is overwritten")
                    return
                kept = tail[:bracket].rstrip()
                f.seek(end - back + len(kept))
                f.truncate()
                f.write((b"\n" if kept.endswith(b"[") else b",\n") + block + b"\n]\n")
        except OSError:
            log.exception("Could not append to the audit trail")
