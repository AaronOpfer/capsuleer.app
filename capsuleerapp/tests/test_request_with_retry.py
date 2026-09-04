import unittest
from unittest import mock

import aiohttp
from aiohttp import web
from aiohttp.test_utils import TestServer

from capsuleerapp.esi import request_with_retry
from capsuleerapp.types import ESIRequestFailure


class TestRequestWithRetryFailureTranslation(unittest.IsolatedAsyncioTestCase):
    async def _make_server(self, status: int) -> tuple[TestServer, list[int]]:
        call_count = []

        async def handler(request):
            call_count.append(1)
            return web.Response(status=status)

        app = web.Application()
        app.router.add_get("/foo", handler)
        server = TestServer(app)
        await server.start_server()
        self.addAsyncCleanup(server.close)
        return server, call_count

    async def test_non_retryable_status_raises_esirequestfailure(self):
        server, call_count = await self._make_server(404)
        url = str(server.make_url("/foo"))

        async with aiohttp.ClientSession() as session:
            with self.assertRaises(ESIRequestFailure) as ctx:
                await request_with_retry(None, session, url, {}, None)

        self.assertEqual(ctx.exception.status, 404)
        self.assertEqual(ctx.exception.url, url)
        self.assertFalse(ctx.exception.likely_downtime)
        self.assertIsInstance(ctx.exception.__cause__, aiohttp.ClientResponseError)
        self.assertEqual(len(call_count), 1)  # not retried

    async def test_retries_exhausted_raises_esirequestfailure(self):
        server, call_count = await self._make_server(503)
        url = str(server.make_url("/foo"))

        async with aiohttp.ClientSession() as session:
            with mock.patch("capsuleerapp.esi.asyncio.sleep"):
                with self.assertRaises(ESIRequestFailure) as ctx:
                    await request_with_retry(None, session, url, {}, None)

        self.assertEqual(ctx.exception.status, 503)
        self.assertEqual(ctx.exception.url, url)
        self.assertFalse(ctx.exception.likely_downtime)
        self.assertEqual(len(call_count), 4)  # 3 retries + final attempt

    async def test_downtime_short_circuits_retries(self):
        server, call_count = await self._make_server(503)
        url = str(server.make_url("/foo"))

        async with aiohttp.ClientSession() as session:
            with mock.patch("capsuleerapp.esi.is_esi_downtime", return_value=True):
                with self.assertRaises(ESIRequestFailure) as ctx:
                    await request_with_retry(None, session, url, {}, None)

        self.assertEqual(ctx.exception.status, 503)
        self.assertEqual(ctx.exception.url, url)
        self.assertTrue(ctx.exception.likely_downtime)
        self.assertEqual(len(call_count), 1)  # no retries during downtime
