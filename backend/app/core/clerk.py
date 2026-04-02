"""
Clerk JWT verification.

Fetches Clerk's JWKS (JSON Web Key Set) and verifies session tokens (RS256).
Returns the decoded payload on success, None on any verification failure.
"""
from __future__ import annotations

import logging
import time
from typing import Optional

import httpx
import jwt as pyjwt
from jwt import PyJWKClient

from app.core.config import settings

logger = logging.getLogger(__name__)

# JWKS client — caches keys automatically
_jwks_client: Optional[PyJWKClient] = None
_jwks_init_time: float = 0
_JWKS_REFRESH_INTERVAL = 3600  # re-init every hour


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client, _jwks_init_time

    now = time.time()
    if _jwks_client is None or (now - _jwks_init_time) > _JWKS_REFRESH_INTERVAL:
        # Clerk JWKS endpoint
        jwks_url = f"https://{_get_clerk_domain()}/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
        _jwks_init_time = now
        logger.info("Clerk JWKS client initialized", extra={"url": jwks_url})

    return _jwks_client


def _get_clerk_domain() -> str:
    """
    Extract the Clerk frontend API domain from the publishable key.
    pk_test_xxx or pk_live_xxx -> the base64 decoded value is the domain.
    Fallback: use the secret key to construct the API URL.
    """
    import base64

    pk = settings.CLERK_PUBLISHABLE_KEY
    if pk:
        # pk_test_<base64 encoded domain> or pk_live_<base64 encoded domain>
        try:
            parts = pk.split("_")
            encoded = parts[-1]
            # Add padding
            padded = encoded + "=" * (4 - len(encoded) % 4)
            domain = base64.b64decode(padded).decode("utf-8").rstrip("$")
            if domain:
                return domain
        except Exception:
            pass

    # Fallback — construct from secret key or use default
    return "clerk.your-domain.com"


def verify_clerk_token(token: str) -> Optional[dict]:
    """
    Verify a Clerk session JWT token.

    Returns the decoded payload dict on success, None on any failure.
    Payload contains: sub (clerk user_id), email, name, etc.
    """
    if not settings.CLERK_SECRET_KEY:
        return None

    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)

        payload = pyjwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={
                "verify_exp": True,
                "verify_nbf": True,
                "verify_iss": False,  # Clerk issuer varies by instance
                "verify_aud": False,  # We don't set a specific audience
            },
        )
        return payload

    except pyjwt.ExpiredSignatureError:
        logger.debug("Clerk token expired")
        return None
    except pyjwt.InvalidTokenError as e:
        logger.debug("Clerk token invalid: %s", e)
        return None
    except Exception as e:
        logger.warning("Clerk token verification error: %s", e)
        return None
