"""Structured types for the Campus Customs shopping agent.

`ChatReply` is the agent's structured output: PydanticAI forces the model to
answer in exactly this shape, and validates it before the API ever sees it.
The tool return types (`ProductInfo`, `PriceLookup`, `StockReport`, ...) are
what the agent's tools hand back to the model, field for field from the DB.
`ChatRequest` / `ChatResponse` / `ProductCard` are the wire format between
the React chat widget and FastAPI. `ShopDeps` is what each agent run knows
about the request (who is signed in, which products its tools returned).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from pydantic import BaseModel, Field

from catalog import ProductSummary

MAX_MESSAGE_CHARS = 1000
MAX_HISTORY_TURNS = 12
MAX_PRODUCT_CARDS = 4
MAX_SUGGESTIONS = 3
MAX_PAGE_PRODUCTS = 36


# --------------------------------------------------------------------------- agent output


class PageUpdate(BaseModel):
    """Products the agent wants shown on the website itself, as a full results page."""

    headline: str = Field(
        description="Short page heading in our voice, e.g. 'Hoodies for every Yale fan' or 'Navy crewnecks under $60'. Max ~60 characters.",
        max_length=80,
    )
    intro: str = Field(
        description="One friendly sentence shown under the heading, describing what the customer is looking at.",
        max_length=240,
    )
    from_search: bool = Field(
        default=False,
        description=(
            "True = show every result of your most recent search_products call, in its order. Preferred: "
            "it is faster than writing out the ids. Leave product_ids empty when you use it."
        ),
    )
    product_ids: list[str] = Field(
        default_factory=list,
        description=(
            "Only when from_search is false (e.g. a hand-picked or filtered subset): the products to show, "
            "best first, up to 36 product_id values returned by your tools in this conversation."
        ),
        max_length=MAX_PAGE_PRODUCTS,
    )


class ChatReply(BaseModel):
    """The agent's answer to one customer message."""

    reply: str = Field(
        description=(
            "The message shown to the customer, in the Bulldog Blue voice. Plain text; "
            "use **double asterisks** to bold product names or prices. Keep it short: "
            "2-5 sentences, or a brief intro plus up to 4 short lines."
        ),
        max_length=1500,
    )
    product_ids: list[str] = Field(
        default_factory=list,
        description=(
            "product_id values of the items you are recommending in this reply, best first. "
            "Only ids returned by your tools in this conversation. Empty for small talk, "
            "policy questions, or declined requests. The shop renders these as product cards."
        ),
        max_length=MAX_PRODUCT_CARDS,
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description=(
            "Up to 3 short follow-up prompts the customer might tap next, written from the "
            "customer's point of view (e.g. 'Is it in stock in M?', 'Show me navy options'). "
            "Each under 40 characters."
        ),
        max_length=MAX_SUGGESTIONS,
    )
    page: PageUpdate | None = Field(
        default=None,
        description=(
            "Set this when the customer is browsing or searching for a SET of products "
            "('what hoodies do you have', 'navy crewnecks under $60', 'gifts for Dad'): the website "
            "then shows every matching product as full product cards. Leave null for questions about "
            "one specific product, prices, stock, policies, small talk, or declined requests."
        ),
    )


# --------------------------------------------------------------------------- tool return types
#
# Every tool returns one of these models instead of a loose dict. PydanticAI
# serialises them to JSON for the model, so the agent always receives the same
# named fields, and each field is traceable to a column in campus_customs.db.

StockStatus = Literal["in_stock", "low_stock", "sold_out"]


class ToolError(BaseModel):
    """Returned instead of data when a lookup cannot be answered from the database."""

    error: str
    hint: str


class ProductBrief(BaseModel):
    """One search hit: enough to shortlist and recommend, not a full product page."""

    product_id: str
    name: str
    category: str
    price: float
    colors: list[str]
    summary: str
    sizes_in_stock: list[str]


class SearchResults(BaseModel):
    match_count: int
    results: list[ProductBrief]


class ProductMatch(BaseModel):
    """A catalogue product whose name matches what the customer typed."""

    product_id: str
    name: str
    category: str
    price: float
    match: Literal["exact", "partial"]


class ProductMatches(BaseModel):
    query: str
    matches: list[ProductMatch]


class ProductInfo(BaseModel):
    """Everything the catalogue records about one product, plus which sizes are in stock."""

    product_id: str
    name: str
    category: str
    garment_type: str
    description: str
    colors: list[str]
    colors_recorded: bool
    style_tags: list[str]
    price: float
    currency: Literal["USD"] = "USD"
    sizes_offered: list[str]
    sizes_in_stock: list[str]
    sizes_sold_out: list[str]
    page_url: str
    data_note: str | None = None


class PriceQuote(BaseModel):
    product_id: str
    name: str
    price: float
    currency: Literal["USD"] = "USD"
    display: str


class PriceLookup(BaseModel):
    quotes: list[PriceQuote]
    not_found: list[str]


class SizeAvailability(BaseModel):
    size: str
    quantity: int
    status: StockStatus
    customer_message: str


class AlternativeProduct(BaseModel):
    """A similar product that IS in stock in the size the customer asked for."""

    product_id: str
    name: str
    price: float
    colors: list[str]
    quantity_in_size: int


class StockReport(BaseModel):
    """Live stock for one product, straight from the inventory table."""

    product_id: str
    name: str
    price: float
    checked_at: str
    low_stock_threshold: int
    sizes: list[SizeAvailability]
    total_units: int
    sizes_in_stock: list[str]
    sizes_sold_out: list[str]
    requested_size: str | None = None
    requested_size_status: StockStatus | Literal["not_offered"] | None = None
    nearest_sizes_in_stock: list[str] = Field(default_factory=list)
    similar_in_stock: list[AlternativeProduct] = Field(default_factory=list)


class CategoryOverview(BaseModel):
    category: str
    products: int
    price_from: float
    price_to: float


# --------------------------------------------------------------------------- customer memory and page context
#
# PageContext arrives from the browser with every chat message and describes
# what the customer is looking at right now (for guests and signed-in
# customers alike). CustomerProfile is built on the server from the users,
# chat_messages, and product_views tables, only for a signed-in customer and
# only from their own rows.

PageType = Literal["home", "products", "concierge_results", "product", "about", "login", "create_account", "other"]


class BagLine(BaseModel):
    """One line of the customer's bag as the browser holds it (ids only; prices come from the DB)."""

    product_id: str = Field(max_length=120)
    size: str = Field(max_length=8)
    quantity: int = Field(ge=1, le=99)


class PageContext(BaseModel):
    """What the customer is viewing when they send a message. Sent by the browser, so the
    server checks every id against the catalogue and treats the free text as data only."""

    page_type: PageType = "other"
    path: str = Field(default="/", max_length=200)
    product_id: str | None = Field(default=None, max_length=120)
    selected_size: str | None = Field(default=None, max_length=8)
    category: str | None = Field(default=None, max_length=40)
    search: str | None = Field(default=None, max_length=100)
    sort: str | None = Field(default=None, max_length=20)
    concierge_headline: str | None = Field(default=None, max_length=120)
    concierge_query: str | None = Field(default=None, max_length=MAX_MESSAGE_CHARS)
    concierge_product_ids: list[str] = Field(default_factory=list, max_length=MAX_PAGE_PRODUCTS)
    bag: list[BagLine] = Field(default_factory=list, max_length=30)
    recently_viewed: list[str] = Field(default_factory=list, max_length=12)


class ViewedProduct(BaseModel):
    """A product the signed-in customer opened on an earlier or current visit (product_views)."""

    product_id: str
    name: str
    category: str
    price: float
    times_viewed: int
    last_viewed_at: str


class CustomerProfile(BaseModel):
    """Everything the agent may know about the signed-in customer: their own account and memory.
    Never includes the password hash, internal ids, or anything about other customers."""

    first_name: str
    last_name: str | None
    full_name: str
    email: str
    member_since: str = Field(description="Account creation date, YYYY-MM-DD.")
    days_as_member: int
    saved_messages: int = Field(description="Messages in their saved chat history.")
    first_chat_at: str | None
    last_chat_at: str | None
    sizes_mentioned: list[str] = Field(description="Sizes they asked about in past chats, most frequent first.")
    favorite_categories: list[str] = Field(description="Departments they browse and ask about most, from views and chat cards.")
    recently_viewed: list[ViewedProduct]
    recent_questions: list[str] = Field(description="Their last few chat questions, newest first.")
    preferred_size: str | None = Field(default=None, description="The size they saved in My Account; use it by default.")
    wishlist_count: int = Field(default=0, description="Pieces saved to their wishlist (get_my_wishlist lists them).")
    order_count: int = Field(default=0, description="Orders placed while signed in (get_my_orders lists them).")


class BagItemStatus(BaseModel):
    """A bag line re-checked against live price and stock."""

    product_id: str
    name: str
    category: str
    size: str
    quantity: int
    unit_price: float
    line_total: float
    units_left_in_size: int
    status: Literal["ok", "low_stock", "more_than_available", "sold_out"]
    note: str


class CurrentPage(BaseModel):
    page_type: PageType
    description: str
    product: ProductBrief | None = None
    stock_line: str | None = Field(default=None, description="Every size of the open product with its live quantity.")
    selected_size: str | None = None
    selected_size_message: str | None = None
    category: str | None = None
    search: str | None = None
    concierge_headline: str | None = None
    concierge_query: str | None = None
    concierge_product_count: int = 0
    concierge_product_ids: list[str] = Field(default_factory=list)


class ShoppingContext(BaseModel):
    """What the customer is looking at and holding right now, re-read from the database."""

    signed_in: bool
    current_page: CurrentPage
    bag: list[BagItemStatus]
    bag_units: int
    bag_subtotal: float
    recently_viewed: list[ProductBrief]
    note: str


# --------------------------------------------------------------------------- agent dependencies


@dataclass
class ShopDeps:
    """Per-request context handed to every tool through RunContext.deps."""

    user_id: int | None = None
    first_name: str | None = None
    seen_product_ids: set[str] = field(default_factory=set)
    customer: CustomerProfile | None = None
    page: PageContext | None = None
    # Per-turn working memory: ids of the latest search (so a results page needs no id list)
    # and earlier tool results (so an identical repeat call costs no extra round trip).
    last_search_ids: list[str] = field(default_factory=list)
    tool_results: dict[str, Any] = field(default_factory=dict)
    # Bag adds and wishlist saves the concierge performed this turn, returned with the reply.
    actions: list[ChatAction] = field(default_factory=list)

    @property
    def signed_in(self) -> bool:
        return self.user_id is not None

    @property
    def viewing_product_id(self) -> str | None:
        return self.page.product_id if self.page else None


# --------------------------------------------------------------------------- HTTP wire format


class HistoryTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)
    product_ids: list[str] = Field(default_factory=list, max_length=MAX_PRODUCT_CARDS)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)
    history: list[HistoryTurn] = Field(default_factory=list, max_length=60)
    page_context: PageContext | None = None


class ProductCard(BaseModel):
    """A product the chat widget renders as a tappable card."""

    id: str
    name: str
    price: float
    category: str
    image_url: str
    url: str
    in_stock: bool
    sizes_available: list[str]


class ChatPage(BaseModel):
    """The results page the website renders from a chat search.

    `products` uses exactly the same `ProductSummary` shape as GET /api/products,
    so the storefront renders them with its normal product card and links.
    """

    id: str
    headline: str
    intro: str
    query: str
    products: list[ProductSummary]


class ChatAction(BaseModel):
    """Something the concierge did for the customer, validated against live stock by a tool.
    Wishlist saves are already written to the database; bag adds are carried out by the browser,
    because the bag lives on the customer's device."""

    type: Literal["add_to_bag", "save_to_wishlist"]
    product_id: str
    name: str
    price: float
    image_url: str
    size: str | None = None
    quantity: int = 1
    max_quantity: int | None = Field(default=None, description="Units left in that size, so the bag cannot exceed stock.")


class ChatResponse(BaseModel):
    reply: str
    products: list[ProductCard] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    page: ChatPage | None = None
    actions: list[ChatAction] = Field(default_factory=list)


class SavedMessage(BaseModel):
    """A stored turn from chat_messages, used to restore a signed-in customer's chat."""

    id: int
    role: Literal["user", "assistant"]
    content: str
    products: list[ProductCard] = Field(default_factory=list)
    created_at: str
