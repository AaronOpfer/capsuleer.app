import asyncio
import logging
from typing import Any, Self

import aiohttp
from jose import jwt
from jose.exceptions import JWTError

log = logging.getLogger(__name__)


SSO_META_DATA_URL = "https://login.eveonline.com/.well-known/oauth-authorization-server"
JWK_ALGORITHM = "RS256"
JWK_ISSUERS = ("login.eveonline.com", "https://login.eveonline.com")
JWK_AUDIENCE = "EVE Online"


class EveJWTValidator:
    __slots__ = "_session", "_jwk_set", "_jwk_lock"
    _session: aiohttp.ClientSession
    _jwk_set: dict[str, Any] | None

    def __init__(self, session: aiohttp.ClientSession) -> None:
        self._session = session
        self._jwk_set = None
        self._jwk_lock = asyncio.Lock()

    async def __aenter__(self) -> Self:
        self._jwk_set = await self._refresh_jwk()
        return self

    async def __aexit__(self, *exc_info) -> None:
        del self._jwk_set

    async def validate(self, token: str) -> dict[str, Any]:
        try:
            return self._decode(token)
        except JWTError:
            log.debug(
                "JWT decode failed with cached JWK; invalidating and retrying once."
            )
            self._jwk_set = None
            self._jwk_set = await self._refresh_jwk()
            return self._decode(token)

    async def _refresh_jwk(self) -> dict[str, Any]:
        async with self._jwk_lock:
            if self._jwk_set is not None:
                return self._jwk_set

            async with self._session.get(SSO_META_DATA_URL) as resp:
                resp.raise_for_status()
                meta = await resp.json()

            try:
                jwks_uri = meta["jwks_uri"]
            except KeyError:
                raise RuntimeError(
                    f"Invalid data received from the SSO meta data endpoint: {meta}"
                ) from None

            async with self._session.get(jwks_uri) as resp:
                resp.raise_for_status()
                data = await resp.json()
            try:
                jwk_sets = data["keys"]
            except KeyError:
                raise RuntimeError(
                    f"Invalid data received from the JWKS endpoint: {data}"
                ) from None

            matches = [k for k in jwk_sets if k.get("alg") == JWK_ALGORITHM]
            if not matches:
                raise RuntimeError(
                    f"No JWK with algorithm {JWK_ALGORITHM!r} found in JWKS response."
                )
            return matches[-1]

    def _decode(self, token: str) -> dict[str, Any]:
        return jwt.decode(
            token=token,
            key=self._jwk_set,
            algorithms=self._jwk_set["alg"],
            issuer=JWK_ISSUERS,
            audience=JWK_AUDIENCE,
        )
