import datetime
import unittest

from aiohttp import web
from aiohttp.test_utils import TestServer

from capsuleerapp.esi import ESISession
from capsuleerapp.types import AccessToken, Character


class FakeSession:
    def __init__(self):
        self.character = Character(1, "Test Character")
        self.access_token = AccessToken(
            "token",
            datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=1),
            "refresh",
        )

    async def set_access_token(self, new_token):
        self.access_token = new_token


ORDER_PAGE = [
    {"price": 100.0, "type_id": 40520, "is_buy_order": False} for _ in range(1000)
]
RESPONSE_HEADERS = {"Expires": "0", "Last-Modified": "0"}


class TestGetStructureMarketOrders(unittest.IsolatedAsyncioTestCase):
    async def _make_esi(self, handler) -> ESISession:
        app = web.Application()
        app.router.add_get("/markets/structures/{structure_id}", handler)
        server = TestServer(app)
        await server.start_server()
        self.addAsyncCleanup(server.close)

        esi = ESISession(str(server.make_url("")), "client-id", "client-secret")
        await esi.__aenter__()
        self.addAsyncCleanup(esi.__aexit__, None, None, None)
        return esi

    async def test_404_on_later_page_ends_pagination(self):
        async def handler(request):
            page = int(request.query["page"])
            if page == 1:
                return web.json_response(ORDER_PAGE, headers=RESPONSE_HEADERS)
            return web.json_response(
                {"error": "Requested page does not exist!"},
                status=404,
                headers=RESPONSE_HEADERS,
            )

        esi = await self._make_esi(handler)
        orders = await esi.get_structure_market_orders(FakeSession(), 123)
        self.assertEqual(orders, ORDER_PAGE)

    async def test_403_blacklists_citadel(self):
        async def handler(request):
            return web.json_response(
                {"error": "market access denied"},
                status=403,
                headers=RESPONSE_HEADERS,
            )

        esi = await self._make_esi(handler)
        orders = await esi.get_structure_market_orders(FakeSession(), 456)
        self.assertEqual(orders, [])
        self.assertIn(456, esi._bad_citadels)

        # subsequent calls skip the network entirely
        orders_again = await esi.get_structure_market_orders(FakeSession(), 456)
        self.assertEqual(orders_again, [])


class TestGetBestPrice(unittest.IsolatedAsyncioTestCase):
    async def test_uses_prefetched_citadel_orders_without_refetching(self):
        # No /markets/structures/* route is registered, so get_best_price
        # must not make any structure-market requests of its own.
        async def region_orders_handler(request):
            return web.json_response(
                [{"price": 150.0, "type_id": 40520, "is_buy_order": False}],
                headers=RESPONSE_HEADERS,
            )

        app = web.Application()
        app.router.add_get("/markets/{region_id}/orders/", region_orders_handler)
        server = TestServer(app)
        await server.start_server()
        self.addAsyncCleanup(server.close)

        esi = ESISession(str(server.make_url("")), "client-id", "client-secret")
        await esi.__aenter__()
        self.addAsyncCleanup(esi.__aexit__, None, None, None)

        citadel_orders = {
            111: [{"price": 90.0, "type_id": 40520, "is_buy_order": False}],
            222: [],
        }
        price = await esi.get_best_price(
            FakeSession(), "sell", citadel_orders, 10000002, 40520
        )
        self.assertEqual(price, 90.0)
