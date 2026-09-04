import unittest

from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

from capsuleerapp.__main__ import esi_failure_middleware
from capsuleerapp.types import ESIRequestFailure


class TestESIFailureMiddleware(unittest.IsolatedAsyncioTestCase):
    async def _make_client(self, likely_downtime: bool) -> TestClient:
        async def handler(request):
            raise ESIRequestFailure._make(503, "http://esi/foo", likely_downtime)

        app = web.Application(middlewares=[esi_failure_middleware])
        app.router.add_get("/", handler)
        client = TestClient(TestServer(app))
        await client.start_server()
        self.addAsyncCleanup(client.close)
        return client

    async def test_translates_to_503_with_downtime_true(self):
        client = await self._make_client(True)
        resp = await client.get("/")
        self.assertEqual(resp.status, 503)
        self.assertEqual(
            await resp.json(), {"error": "esi_unavailable", "likely_downtime": True}
        )

    async def test_translates_to_503_with_downtime_false(self):
        client = await self._make_client(False)
        resp = await client.get("/")
        self.assertEqual(resp.status, 503)
        self.assertEqual(
            await resp.json(), {"error": "esi_unavailable", "likely_downtime": False}
        )
