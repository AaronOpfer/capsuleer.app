import enum
import time
import random
import asyncio
import logging
import datetime
import functools

import aiohttp

from .data import forge_npc_station_ids
from .types import (
    Response,
    Character,
    ABCSession,
    ESILimiter,
    AccessToken,
    RefreshTokenError,
    CharacterNeedsUpdated,
)

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


def _make_header_from_token(token: AccessToken) -> dict[str, str]:
    return {
        "User-Agent": "capsuleer.app me@aaronopfer.com",
        "Host": "esi.evetech.net",
        "Accept": "application/json",
        "Authorization": f"Bearer {token.access_token}",
    }


def _make_header_from_session(session: ABCSession) -> dict[str, str]:
    headers = _make_header_from_token(session.access_token)
    headers["X-Character"] = session.character.name
    return headers


class SessionType(enum.Enum):
    none = 0
    headers = 1
    character = 2


RETRY_ERROR_STATUSES = frozenset({502, 503, 504})


async def request_with_retry(
    esilimiter: ESILimiter,
    session: aiohttp.ClientSession,
    url: str,
    headers: dict[str, str],
    params: dict[str, str] | None,
) -> Response:
    """
    The ESI API will sometimes fail for no particular reason. When this
    happens, retry the request again. We wait before retrying in order
    to avoid contributing to a flood situation.
    """

    async def request():
        async with esilimiter:
            async with session.get(url, headers=headers, params=params) as resp:
                if resp.status in RETRY_ERROR_STATUSES:
                    resp.raise_for_status()

                try:
                    res = await resp.json()
                except Exception:
                    # Attempt to raise a double-stacktrace.
                    resp.raise_for_status()
                    raise
                try:
                    resp.raise_for_status()
                except Exception:
                    logger.error("%s %d: %r", url, resp.status, res)
                    raise

                return Response(res, resp)

    for attempt in range(3):
        sleep_length = attempt + random.uniform(0.5, 1.5)
        try:
            return await request()
        except aiohttp.ClientResponseError as exc:
            if exc.status not in RETRY_ERROR_STATUSES:
                raise
            logger.warning(
                "GET %s hit %d, sleeping for %d and trying again",
                url,
                exc.status,
                sleep_length,
            )
        except aiohttp.ServerDisconnectedError:
            logger.warning(
                "GET %s encountered server disconnect, sleeping for %d and trying again",
                url,
                sleep_length,
            )

        await asyncio.sleep(sleep_length)

    # For the last attempt, don't use try..except.
    return await request()


def _esi(
    version: int,
    url_format: str,
    name: str,
    session_type: SessionType = SessionType.none,
    accepts_params: bool = False,
):
    if accepts_params is not True and accepts_params is not False:
        raise TypeError("accepts_params must be a boolean")
    if type(version) is not int:
        raise TypeError("version must be an integer")

    accepted_arg_count = len(url_format.split("{}")) - 1
    url_format_func = (f"/v{version}/" + url_format).format
    url_format_func = ("/"+url_format).format

    if session_type is SessionType.headers:
        accepted_arg_count += 1  # takes a hidden session argument

    async def inner(
        self: "PublicESISession", *args, params: dict[str, str] | None = None
    ) -> Response:
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
            headers = _make_header_from_session(session)
            if session_type is SessionType.character:
                args = session.character.id, *args

        url = self._esi_url + url_format_func(*args)
        resp = await request_with_retry(
            self._esilimiter, self._session, url, headers, params
        )
        try:
            remaining = int(resp.headers["X-ESI-Error-Limit-Remain"])
            timeout = int(resp.headers["X-ESI-Error-Limit-Reset"])
            self._esilimiter.set_remaining(resp.date, remaining - 1, timeout + 0.5)
        except Exception:
            logger.warning(
                "Ignoring error parsing X-ESI-Error-Limit-Remain", exc_info=True
            )
        return resp

    inner.__name__ = name
    if session_type is not SessionType.none:
        return _requires_session(inner)
    return inner


class PublicESISession:
    __slots__ = (
        "_esi_url",
        "_session",
        "_bad_citadels",
        "_forge_citadel_cache",
        "_esilimiter",
    )

    def __init__(self, esi_url):
        headers = {
            "User-Agent": "capsuleer.app me@aaronopfer.com",
            "Accept": "application/json",
            "Host": "esi.evetech.net",
        }
        self._esilimiter = ESILimiter()

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
            1_041_701_800_198,
        }

    async def __aenter__(self):
        await self._session.__aenter__()
        return self

    async def __aexit__(self, a, b, c):
        return await self._session.__aexit__(a, b, c)

    async def get_market_orders(
        self, region_id: int, buy_sell: str, type_id: int | None = None
    ):
        page = 0
        params = {"order_type": buy_sell}
        if type_id is not None:
            params["type_id"] = str(type_id)

        while True:
            page += 1
            try:
                orders = await self._get_region_orders(
                    region_id, params={"page": str(page), **params}
                )
            except aiohttp.ClientResponseError as exc:
                # Reading past the last page emits a 404 error.
                # Treat this like an empty orders return value.
                if page == 1 or exc.status != 404:
                    raise
                orders = ()

            for item in orders:
                yield item
            if len(orders) < 1000:
                logging.info(
                    "get_market_orders(%r, %r, %r) made %d requests",
                    region_id,
                    buy_sell,
                    type_id,
                    page,
                )
                return

    get_forge_orders = functools.partialmethod(get_market_orders, 10_000_002)

    async def get_forge_market_citadel_ids(self):
        """
        Retrieves the location IDs for citadels in The Forge with markets.
        Done by scanning the Jita buy orders (expensive!)
        """
        now = datetime.datetime.now(datetime.UTC)
        try:
            result, fetch_dt = self._forge_citadel_cache
            if now - fetch_dt > datetime.timedelta(hours=12):
                raise AttributeError
            return result
        except AttributeError:
            pass
        orders = self.get_forge_orders("buy")
        result = {o["location_id"] async for o in orders} - forge_npc_station_ids
        self._forge_citadel_cache = result, now
        return result

    # fmt: off
    get_type_information = _esi(3, "universe/types/{}", "get_type_information")
    get_region_information = _esi(1, "universe/regions/{}", "get_region_information")
    get_constellation_information = _esi(1, "universe/constellations/{}", "get_constellation_information")
    get_system_information = _esi(4, "universe/systems/{}", "get_system_information")
    get_item_group_information = _esi(1, "universe/groups/{}", "get_item_group_information")
    get_item_category_information = _esi(1, "universe/categories/{}", "get_item_category_information")
    _get_region_orders = _esi(1, "markets/{}/orders/", "_get_region_orders", accepts_params=True)
    get_market_group = _esi(1, "markets/groups/{}", "get_market_group")
    # fmt: on


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
            "https://login.eveonline.com/v2/oauth/token",
            data={"grant_type": "authorization_code", "code": authz_code},
        ) as resp:
            resp.raise_for_status()
            results = await resp.json()
            return AccessToken(
                results["access_token"],
                datetime.datetime.now(datetime.UTC)
                + datetime.timedelta(seconds=results["expires_in"]),
                results["refresh_token"],
            )

    async def _get_refresh_token(self, refresh_token):
        async with self._login_session.post(
            "https://login.eveonline.com/v2/oauth/token",
            data={"grant_type": "refresh_token", "refresh_token": refresh_token},
        ) as resp:
            data = await resp.json()
            if "error" in data:
                logger.info("refresh token error: %r", data)
                raise RefreshTokenError(data["error"], data["error_description"])

            resp.raise_for_status()
            return data

    async def _update_session_refresh_token(self, session: ABCSession) -> None:
        token = session.access_token
        refresh_token = token.refresh_token
        try:
            results = await self._get_refresh_token(refresh_token)
        except RefreshTokenError as exc:
            logger.warning(
                "Refresh of token for %d(%s) failed. error=%r, description=%r",
                session.character.id,
                session.character.name,
                exc.args[0],
                exc.args[1],
            )
            await session.set_access_token(None)
            raise CharacterNeedsUpdated() from None
        else:
            logger.debug(
                "%d(%s) token refresh successful",
                session.character.id,
                session.character.name,
            )
            await session.set_access_token(
                AccessToken(
                    results["access_token"],
                    datetime.datetime.now(datetime.UTC)
                    + datetime.timedelta(seconds=results["expires_in"]),
                    results["refresh_token"],
                )
            )

    async def _verify_session(self, session: ABCSession) -> None:
        # Is there already a refresh in progress for this character?
        try:
            refresh_task = self._refresh_token_tasks[session.character.id]
        except KeyError:
            pass  # no, there isn't.
        else:
            # Yes, there is. shield it, await it, and return.
            await asyncio.shield(refresh_task)
            return

        # No refresh in progress. check if the token is present and valid.
        token = session.access_token
        if token is None:
            raise CharacterNeedsUpdated

        if token.expired_after > datetime.datetime.now(datetime.UTC):
            # Expiration is in the future. no work to do.
            return

        # schedule the work for refreshing the user's token.
        refresh_task = asyncio.ensure_future(
            self._update_session_refresh_token(session)
        )
        self._refresh_token_tasks[session.character.id] = refresh_task
        refresh_task.add_done_callback(
            lambda fut: self._refresh_token_tasks.pop(session.character.id)
        )

        await asyncio.shield(refresh_task)

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
                if e.status == 403:
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

    _STC = SessionType.character
    _STH = SessionType.headers
    # fmt: off
    get_skills = _esi(4, "characters/{}/skills", "get_skills", _STC)
    get_skill_queue = _esi(2, "characters/{}/skillqueue/", "get_skill_queue", _STC)
    get_wallet_balance = _esi(1, "characters/{}/wallet", "get_wallet_balance", _STC)
    get_wallet_journal = _esi(6, "characters/{}/wallet/journal/", "get_wallet_journal", _STC)
    get_attributes = _esi(1, "characters/{}/attributes/", "get_attributes", _STC)
    get_implants = _esi(1, "characters/{}/implants/", "get_implants", _STC)
    _get_structure_market = _esi(1, "markets/structures/{}", "_get_structure_market", _STH, True)
    # fmt: on


def get_character(claims) -> tuple[Character, str]:
    return (Character(int(claims["sub"][14:]), claims["name"]), claims["owner"])
