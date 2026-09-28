"""Authentication utilities for Campus Customs.

Covers password hashing/verification and signed session tokens. The design goals
are the ones a modern shop is expected to meet:

* Passwords are never stored in plaintext or reversible form. We keep only a
  salted PBKDF2-HMAC-SHA256 hash, using 600,000 iterations (OWASP 2023 guidance
  for PBKDF2-SHA256) and a fresh 16-byte random salt per user.
* The hash string is self-describing (`pbkdf2_sha256$iterations$salt$hash`), so
  the work factor can be raised over time and old hashes upgraded transparently.
* Verification also understands the legacy seed format already in the database
  (`pbkdf2_sha256$salt$hash`, 120,000 iterations), and flags those rows for
  transparent rehashing on the next successful login.
* Comparisons are constant-time to avoid timing side channels.
* Session tokens are HMAC-signed and carry an expiry, so a stolen or tampered
  cookie cannot be forged without the server secret.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from pathlib import Path

ALGORITHM = "pbkdf2_sha256"
ITERATIONS = 600_000
SALT_BYTES = 16
LEGACY_ITERATIONS = 120_000

_SECRET_FILE = Path(__file__).resolve().parent / ".session_secret"


# --------------------------------------------------------------------------- passwords


def hash_password(password: str) -> str:
    """Return a self-describing PBKDF2-SHA256 hash for a new/updated password."""
    salt = secrets.token_bytes(SALT_BYTES)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERATIONS)
    return f"{ALGORITHM}${ITERATIONS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Verify a password against a stored hash (modern or legacy format)."""
    parts = stored.split("$")
    try:
        if len(parts) == 4:  # modern: algo$iterations$salt_hex$hash_hex
            algo, iterations, salt_hex, hash_hex = parts
            if algo != ALGORITHM:
                return False
            salt = bytes.fromhex(salt_hex)
            iters = int(iterations)
            expected = bytes.fromhex(hash_hex)
        elif len(parts) == 3:  # legacy seed: algo$salt_string$hash_hex
            algo, salt_str, hash_hex = parts
            if algo != ALGORITHM:
                return False
            salt = salt_str.encode("utf-8")
            iters = LEGACY_ITERATIONS
            expected = bytes.fromhex(hash_hex)
        else:
            return False
    except (ValueError, TypeError):
        return False

    candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iters)
    return hmac.compare_digest(candidate, expected)


def needs_rehash(stored: str) -> bool:
    """True when a stored hash should be upgraded to the current work factor."""
    parts = stored.split("$")
    if len(parts) != 4 or parts[0] != ALGORITHM:
        return True
    try:
        return int(parts[1]) < ITERATIONS
    except ValueError:
        return True


# --------------------------------------------------------------------------- sessions


def get_secret() -> bytes:
    """Load (or create once) the server secret used to sign session tokens."""
    env = os.environ.get("CC_SESSION_SECRET")
    if env:
        return env.encode("utf-8")
    if _SECRET_FILE.exists():
        return _SECRET_FILE.read_bytes()
    secret = secrets.token_bytes(32)
    _SECRET_FILE.write_bytes(secret)
    return secret


def make_session_token(user_id: int, secret: bytes, max_age_days: int = 30) -> str:
    expires = int(time.time()) + max_age_days * 86_400
    payload = f"{user_id}.{expires}"
    signature = hmac.new(secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"


def read_session_token(token: str, secret: bytes) -> int | None:
    try:
        user_id, expires, signature = token.split(".")
        payload = f"{user_id}.{expires}"
    except (ValueError, AttributeError):
        return None
    expected = hmac.new(secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return None
    if int(expires) < time.time():
        return None
    return int(user_id)
