from esi.types import ESILimiter
import asyncio
import unittest
import datetime


TIME_1 = datetime.datetime.now(datetime.timezone.utc)
TIME_2 = TIME_1 + datetime.timedelta(seconds=5)
TIME_3 = TIME_2 + datetime.timedelta(seconds=5)


class TestESILimiter(unittest.IsolatedAsyncioTestCase):
    async def test_normal(self):

        limiter = ESILimiter()
        limiter.set_remaining(TIME_1, 1, 60)

        barrier = asyncio.Barrier(3)

        async def request(x):
            async with limiter:
                async with barrier:
                    return x

        result = asyncio.ensure_future(
            asyncio.gather(request(1), request(2), request(3))
        )
        await asyncio.sleep(0.001)
        self.assertFalse(result.done())
        limiter.set_remaining(TIME_2, 2, 60)
        # still not ready...
        await asyncio.sleep(0.001)
        self.assertFalse(result.done())
        # okay, now we can go.
        limiter.set_remaining(TIME_3, 3, 60)
        self.assertEqual((await result), [1, 2, 3])

    async def test_timers(self):
        limiter = ESILimiter()
        limiter.set_remaining(TIME_1, 0, 0.1)  # no room left, but has a timeout.

        async def request(x):
            async with limiter:
                return x

        result = asyncio.ensure_future(request(1))
        await asyncio.sleep(0.001)
        self.assertFalse(result.done())
        # but wait a little longer this time.
        self.assertEqual((await result), 1)

    async def test_ignore_out_of_order_changes(self):
        limiter = ESILimiter()
        limiter.set_remaining(TIME_2, 1000, 1000)  # no room left, but has a timeout.

        async def request(x):
            async with limiter:
                return x

        # this attempt to set the limit to zero should be ignored,
        # because it happened before the previous (TIME_1 < TIME_2)
        limiter.set_remaining(TIME_1, 0, 1000)
        self.assertEqual(await request(1), 1)
