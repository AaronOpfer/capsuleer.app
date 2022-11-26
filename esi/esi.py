import asyncio
import time
import enum
import datetime
import logging
import functools
import random
from typing import Tuple

import aiohttp
from .types import (
    Character,
    AccessToken,
    ABCSession,
    RefreshTokenError,
    CharacterNeedsUpdated,
    Response,
)
from .data import forge_npc_station_ids


logger = logging.getLogger(__name__)


def _requires_session(f):
    async def wrapper(self, session, *args, **kwargs):
        start_time = time.monotonic()
        try:
            await self._verify_session(session)
            return await f(self, session, *args, **kwargs)
        finally:
            elapsed = time.monotonic() - start_time
            logger.info("%s took %.2fms", f.__name__, elapsed * 1000)

    return wrapper


class SessionType(enum.Enum):
    none = 0
    headers = 1
    character = 2


def _esi(
    version, url_format, name, accepts_params=False, session_type=SessionType.none
):
    if accepts_params is not True and accepts_params is not False:
        raise TypeError("accepts_params must be a boolean")
    if type(version) is not int:
        raise TypeError("version must be an integer")

    accepted_arg_count = len(url_format.split("{}")) - 1
    url_format = (f"/v{version}/" + url_format).format

    if session_type is not SessionType.none:
        accepted_arg_count += 1  # takes a session argument

    if session_type is SessionType.character:
        accepted_arg_count -= 1  # fills first arg with character_id

    async def inner(self, *args, params=None):
        if accepts_params is False and params is not None:
            raise ValueError(f"{name} does not accept parameters")

        if len(args) != accepted_arg_count:
            raise TypeError(
                f"{name}() takes {accepted_arg_count} positional arguments "
                f"but {len(args)} was given"
            )

        headers = {}
        if session_type is not SessionType.none:
            session, *args = args
            headers = self._make_header_from_session(session)
            if session_type is SessionType.character:
                args = session.character.id, *args

        error_statuses = frozenset({502, 503, 504})
        url = self._esi_url + url_format(*args)

        attempts = range(3)
        for attempt in attempts:
            try:
                async with self._session.get(
                    url, raise_for_status=True, headers=headers, params=params
                ) as resp:
                    res = await resp.json()
                    return Response(res, resp)
            except aiohttp.ClientResponseError as exc:
                if exc.status not in error_statuses:
                    raise

                sleep_length = 10 * attempt + random.randrange(5, 15)
                logger.warning(
                    "GET %s hit %d, sleeping for %d and trying again",
                    url,
                    exc.status,
                    sleep_length,
                )
                await asyncio.sleep(sleep_length)

            # For the last attempt, don't use try..except.
            async with self._session.get(
                url, raise_for_status=True, headers=headers, params=params
            ) as resp:
                res = await resp.json()
                return Response(res, resp)

    inner.__name__ = name
    return inner


_methods = (
    _esi(3, "universe/types/{}", "get_type_information"),
    _esi(1, "universe/regions/{}", "get_region_information"),
    _esi(1, "universe/constellations/{}", "get_constellation_information"),
    _esi(4, "universe/systems/{}", "get_system_information"),
    _esi(1, "universe/groups/{}", "get_item_group_information"),
    _esi(1, "universe/categories/{}", "get_item_category_information"),
    _esi(1, "markets/{}/orders/", "_get_region_orders", True),
    _esi(1, "markets/groups/{}", "get_market_group"),
)

_STC = {"session_type": SessionType.character}
_STH = {"session_type": SessionType.headers}

_session_methods = (
    _esi(4, "characters/{}/skills", "get_skills", **_STC),
    _esi(2, "characters/{}/skillqueue/", "get_skill_queue", **_STC),
    _esi(1, "characters/{}/wallet", "get_wallet_balance", **_STC),
    _esi(6, "characters/{}/wallet/journal/", "get_wallet_journal", **_STC),
    _esi(1, "characters/{}/attributes/", "get_attributes", **_STC),
    _esi(1, "characters/{}/implants/", "get_implants", **_STC),
    _esi(1, "markets/structures/{}", "_get_structure_market", True, **_STH),
)


class PublicESISession:
    __slots__ = ("_esi_url", "_session", "_bad_citadels")

    def __init__(self, esi_url):
        headers = {
            "User-Agent": "capsuleer.app me@aaronopfer.com",
            "Accept": "application/json",
            "Host": "esi.evetech.net",
        }
        if esi_url.startswith("unix://"):
            self._esi_url = ""
            self._session = aiohttp.ClientSession(
                connector=aiohttp.UnixConnector(esi_url[7:]), headers=headers
            )
        else:
            self._esi_url = esi_url
            self._session = aiohttp.ClientSession(headers=headers)

        self._bad_citadels = {
            # These were forbidden the first time I looked up Jita prices.
            1_029_949_899_294,
            1_029_898_792_553,
            1_026_199_596_235,
            1_029_757_417_883,
            1_029_792_736_908,
            1_029_719_938_968,
            1_022_179_194_562,
            1_022_719_559_274,
            1_026_221_929_523,
            1_028_370_750_672,
            1_028_858_195_912,
            1_029_036_975_486,
            1_029_209_158_478,
            1_030_524_644_061,
            1_032_792_278_341,
            1_033_110_865_110,
        }

    async def __aenter__(self):
        await self._session.__aenter__()
        return self

    async def __aexit__(self, a, b, c):
        return await self._session.__aexit__(a, b, c)

    async def get_market_orders(
        self, region_id: int, buy_sell: str, type_id: int = None
    ):
        params = {"order_type": buy_sell, "page": 0}
        if type_id is not None:
            params["type_id"] = type_id

        while True:
            params["page"] += 1
            page = await self._get_region_orders(region_id, params=params)
            for item in page:
                yield item
            if len(page) < 1000:
                logging.info(
                    "get_market_orders(%r, %r, %r) made %d requests",
                    region_id,
                    buy_sell,
                    type_id,
                    params["page"],
                )
                return

    get_forge_orders = functools.partialmethod(get_market_orders, 10_000_002)

    for _method in _methods:
        locals()[_method.__name__] = _method
    del _method


class ESISession(PublicESISession):
    __slots__ = "_login_session", "_refresh_token_tasks"

    def __init__(self, esi_url, client_id, client_secret_key):
        super().__init__(esi_url)
        headers = {
            "User-Agent": "capsuleer.app me@aaronopfer.com",
            "Accept": "application/json",
        }
        auth = aiohttp.BasicAuth(client_id, client_secret_key)
        self._login_session = aiohttp.ClientSession(headers=headers, auth=auth)

        # Guard against cancellations
        self._refresh_token_tasks = {}

    async def __aenter__(self):
        await self._session.__aenter__()
        await self._login_session.__aenter__()
        return self

    async def __aexit__(self, a, b, c):
        await self._login_session.__aexit__(a, b, c)  # TODO is thsi ok?
        return await self._session.__aexit__(a, b, c)

    async def get_access_token(self, authz_code) -> AccessToken:
        async with self._login_session.post(
            "https://login.eveonline.com/oauth/token",
            data={"grant_type": "authorization_code", "code": authz_code},
        ) as resp:
            resp.raise_for_status()
            results = await resp.json()
            return AccessToken(
                results["access_token"],
                datetime.datetime.utcnow()
                + datetime.timedelta(seconds=results["expires_in"]),
                results["refresh_token"],
            )

    async def _get_refresh_token(self, refresh_token):
        async with self._login_session.post(
            "https://login.eveonline.com/oauth/token",
            data={"grant_type": "refresh_token", "refresh_token": refresh_token},
        ) as resp:
            data = await resp.json()
            if "error" in data:
                logger.info("refresh token error: %r", data)
                raise RefreshTokenError(data["error"], data["error_description"])

            resp.raise_for_status()
            return data

    async def _verify_session(self, session: ABCSession):
        token = session.access_token
        if token.expired_after > datetime.datetime.utcnow():
            return

        # ensure only one refresh HTTP request is running at once
        refresh_token = token.refresh_token
        try:
            refresh_task = self._refresh_token_tasks[refresh_token]
        except KeyError:
            refresh_task = asyncio.shield(self._get_refresh_token(refresh_token))
            self._refresh_token_tasks[refresh_token] = refresh_task
            refresh_task.add_done_callback(
                lambda fut: self._refresh_token_tasks.pop(refresh_token)
            )

        try:
            results = await refresh_task
        except RefreshTokenError as exc:
            logger.warning(
                "Refresh of token failed. error=%r, description=%r",
                exc.args[0],
                exc.args[1],
            )
            await session.set_access_token(None)
            raise CharacterNeedsUpdated() from None
        else:
            await session.set_access_token(
                AccessToken(
                    results["access_token"],
                    datetime.datetime.utcnow()
                    + datetime.timedelta(seconds=results["expires_in"]),
                    results["refresh_token"],
                )
            )

    @staticmethod
    def _make_header_from_token(token: AccessToken):
        return {
            "User-Agent": "capsuleer.app me@aaronopfer.com",
            "Host": "esi.evetech.net",
            "Accept": "application/json",
            "Authorization": "Bearer %s" % token.access_token,
        }

    @classmethod
    def _make_header_from_session(cls, session: ABCSession):
        headers = cls._make_header_from_token(session.access_token)
        headers["X-Character"] = session.character.name
        return headers

    async def get_character(
        self, access_token: AccessToken
    ) -> Tuple[AccessToken, Character, str]:
        async with self._session.get(
            self._esi_url + "/verify/",
            headers=self._make_header_from_token(access_token),
        ) as resp:
            resp.raise_for_status()
            result = await resp.json()
            return (
                Character(int(result["CharacterID"]), result["CharacterName"], True),
                result["CharacterOwnerHash"],
            )

    for _method in _session_methods:
        locals()[_method.__name__] = _requires_session(_method)
    del _method

    @_requires_session
    async def ensure_session(self, session: ABCSession):
        pass

    @_requires_session
    async def get_structure_market_orders(self, session, structure_id: int):
        params = {"page": 0}
        if structure_id in self._bad_citadels:
            logging.debug(
                "citadel %d is still forbidden, ignoring some more.", structure_id
            )
            return []

        orders = []
        while True:
            params["page"] += 1
            try:
                page = await self._get_structure_market(
                    session, structure_id, params=params
                )
            except aiohttp.ClientResponseError as e:
                if e.code == 403:
                    logging.info("citadel %d is forbidden to us", structure_id)
                    self._bad_citadels.add(structure_id)
                    return []
                raise

            orders += page
            if len(page) < 1000:
                logging.info(
                    "get_structure_market_orders(%d) made %d requests",
                    structure_id,
                    params["page"],
                )
                return orders

    async def get_forge_market_citadel_ids(self):
        """
        Retrieves the location IDs for citadels in The Forge with markets.
        Done by scanning the Jita buy orders (expensive!)
        """
        orders = self.get_forge_orders("buy")
        return {o["location_id"] async for o in orders} - forge_npc_station_ids

    @_requires_session
    async def get_best_price(self, session, buy_sell, citadel_ids, region_id, type_id):
        comparator = max if buy_sell == "buy" else min
        orders = self.get_market_orders(region_id, buy_sell, type_id)
        current_best = None
        async for order in orders:
            if current_best is None:
                current_best = order["price"]
            else:
                current_best = comparator(current_best, order["price"])
        is_buy_order = buy_sell == "buy"

        for citadel_id in citadel_ids:
            order_prices = [
                o["price"]
                for o in await self.get_structure_market_orders(session, citadel_id)
                if o["is_buy_order"] == is_buy_order and o["type_id"] == type_id
            ]
            if order_prices and current_best is None:
                current_best = order_prices[0]
            current_best = comparator([current_best, *[p for p in order_prices]])

        return current_best
