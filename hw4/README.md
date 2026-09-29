# Yale Bulldog Blue by Campus Customs — Homework 4

An online shop for Yale apparel with an AI shopping assistant, the **Bulldog Blue Concierge**.

- **Frontend:** React + Vite + TypeScript storefront (`frontend/`)
- **Backend:** FastAPI app (`backend/main.py`) that serves products, accounts, orders and the chat API
- **Agent:** a PydanticAI agent on OpenAI GPT-5.6 (`gpt-5.6-sol`, via Portkey). It is four files in `backend/`:
  - `prompts/prompt.md`: the system prompt (role, voice, safety rules)
  - `agent.py`: agent entry point and wiring
  - `tools.py`: the tools the agent may call
  - `models.py`: the PydanticAI structured types

The full explanation of how the system works is in **[`output/harness.md`](output/harness.md)**. Start with Problem 12, the complete system reference.

---

## What is where

```
hw4/
├── AI_prompts.md          # log of the prompts used for each problem
├── requirements.txt       # Python packages for the backend
├── .env.example           # template for your .env (placeholders only)
├── .gitignore
├── README.md
├── frontend/              # Vite React TypeScript app
├── backend/
│   ├── main.py            # FastAPI app — run with: uvicorn main:app --reload --port 8000
│   ├── agent.py           # the agent (4 files: agent.py, tools.py, models.py, prompts/prompt.md)
│   ├── models.py
│   ├── tools.py
│   ├── prompts/
│   │   └── prompt.md
│   ├── catalog.py         # shared product and stock helpers (used by main.py and tools.py)
│   ├── customers.py       # customer memory and page context
│   ├── account.py         # My Account, wishlist, checkout and orders
│   ├── auth.py            # password hashing and signed sessions
│   └── audit.py           # writes output/audit_trail.json
└── output/
    ├── harness.md         # how the system works (Problems 1–12)
    ├── design.md          # Problem 10: design changes (+ screenshots in output/design/)
    ├── usability.md       # Problem 9: usability improvements (+ screenshots in output/usability/)
    ├── app_check.html     # Problem 11: live site test, opens by double-click
    ├── app_check_images/  # screenshots linked from app_check.html
    └── audit_trail.json   # append-only log of every agent run
```

The files `catalog.py`, `customers.py`, `account.py`, `auth.py` and `audit.py` support the web app: products, accounts, checkout and the audit log. The agent itself is the four files listed above.

---

## Get the code

```
git clone https://github.com/promberg2/yale-ai-hw4.git
cd yale-ai-hw4/hw4
```

(Or use **Code → Download ZIP** on GitHub and unzip it.) All commands below start in this `hw4/` folder.

## Before you start: place the data pack

The database and product images are **not** in this repository. Copy the course data pack into this folder so that it looks like this:

```
hw4/
└── data/
    ├── campus_customs.db
    └── products/          # images referenced by the catalogue
```

`data/` is listed in `.gitignore`, so it stays on your computer only.

## Requirements

- **Python 3.10 or newer** (tested with 3.14)
- **Node.js 20 or newer** (tested with 24)
- A **Portkey API key** for the model (a direct `OPENAI_API_KEY` also works as a fallback). The repository contains no key, so you need your own. Without one, the whole shop still works except the chat, which then answers that it is having trouble and suggests emailing the store; the backend log says the key is missing.

## 1. Add your API key

In the `hw4/` folder, copy `.env.example` to `.env` and put your key in it:

```
PORTKEY_API_KEY=your_portkey_api_key_here
```

Windows: `copy .env.example .env` · macOS/Linux: `cp .env.example .env`

`.env` is listed in `.gitignore` and is never committed.

## 2. Start the backend (terminal 1)

Windows (PowerShell), from `hw4/`:

```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cd backend
uvicorn main:app --reload --port 8000
```

macOS / Linux, from `hw4/`:

```
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd backend
uvicorn main:app --reload --port 8000
```

If Windows refuses to run `activate` ("running scripts is disabled on this system"), run `Set-ExecutionPolicy -Scope Process Bypass` in that terminal first, or skip activation and call the venv directly: `.venv\Scripts\python -m pip install -r requirements.txt`, then `cd backend` and `..\.venv\Scripts\python -m uvicorn main:app --reload --port 8000`.

Check that it runs: open http://127.0.0.1:8000/api/health. It should show `{"status":"ok","products":102}`.

When it starts for the first time, the backend adds the tables it needs (wishlist, orders, product views) to the database and prepares the product photos. That can take a few seconds.

## 3. Start the frontend (terminal 2)

From `hw4/`:

```
cd frontend
npm install
npm run dev
```

`npm install` may print a warning about install scripts (for `esbuild`); it is harmless and the site runs normally.

Open **http://localhost:5173**. The website forwards `/api` and `/images` requests to the backend on port 8000, so both must be running.

## 4. Try it

- Click the **chat button** at the bottom right and ask, for example:
  - "What hoodies do you have?"
  - "Is the Champion Reverse Weave Crewneck in stock in L?"
- **Create an account** (top right) to try customer memory, the wishlist, checkout and My Account. Or **Log in** with the test account from the data pack: `test@campuscustoms.yale.edu` / `password`.
- Every chat message is recorded in `output/audit_trail.json` (append-only).
- The Problem 11 test report is `output/app_check.html`. GitHub shows HTML files as source code, so open it from your downloaded copy (double-click it); its screenshots are in `output/app_check_images/`.

## Notes

- If you change Python code and the backend doesn't pick it up, stop it (Ctrl+C) and start it again. Changes to `backend/prompts/prompt.md` take effect on the next message without a restart.
- `npm run build` type-checks the frontend and builds a production bundle in `frontend/dist/`.
- The backend creates `backend/.session_secret` (the key that signs login cookies) on first start. It is excluded from git.
