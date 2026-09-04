import asyncio
import gc
import unittest
import weakref
from unittest import mock

from capsuleerapp.esi import RateLimitLogger


class TestRateLimitLogger(unittest.IsolatedAsyncioTestCase):
    async def test_leading_edge_logs_immediately(self):
        rl = RateLimitLogger()
        with self.assertLogs("capsuleerapp.esi", level="INFO") as cm:
            rl.log("char-detail", 12345, "600/15m", 599, "1")
        self.assertEqual(len(cm.output), 1)
        self.assertIn("Remaining=599", cm.output[0])
        self.assertIn("Character=12345", cm.output[0])

    async def test_debounces_within_window_then_flushes_latest(self):
        with mock.patch.object(RateLimitLogger, "DEBOUNCE_SECONDS", 0.05):
            rl = RateLimitLogger()
            with self.assertLogs("capsuleerapp.esi", level="INFO") as cm:
                rl.log("char-detail", 12345, "600/15m", 599, "1")
                rl.log("char-detail", 12345, "600/15m", 598, "2")
                rl.log("char-detail", 12345, "600/15m", 597, "3")
            self.assertEqual(len(cm.output), 1)
            self.assertIn("Remaining=599", cm.output[0])

            with self.assertLogs("capsuleerapp.esi", level="INFO") as cm:
                await asyncio.sleep(0.1)
            self.assertEqual(len(cm.output), 1)
            self.assertIn("Remaining=597", cm.output[0])

    async def test_no_trailing_log_when_quiet(self):
        with mock.patch.object(RateLimitLogger, "DEBOUNCE_SECONDS", 0.05):
            rl = RateLimitLogger()
            rl.log("char-detail", 12345, "600/15m", 599, "1")

            with self.assertNoLogs("capsuleerapp.esi", level="INFO"):
                await asyncio.sleep(0.1)

            with self.assertLogs("capsuleerapp.esi", level="INFO") as cm:
                rl.log("char-detail", 12345, "600/15m", 598, "2")
            self.assertEqual(len(cm.output), 1)

    async def test_zero_bypasses_debounce(self):
        rl = RateLimitLogger()
        with self.assertLogs("capsuleerapp.esi", level="INFO") as cm:
            rl.log("char-detail", 12345, "600/15m", 5, "595")
            rl.log("char-detail", 12345, "600/15m", 0, "600")
        self.assertEqual(len(cm.output), 2)
        self.assertIn("Remaining=0", cm.output[1])

    async def test_del_flushes_pending_log(self):
        rl = RateLimitLogger()
        rl.log("char-detail", 12345, "600/15m", 599, "1")
        rl.log("char-detail", 12345, "600/15m", 598, "2")

        with self.assertLogs("capsuleerapp.esi", level="INFO") as cm:
            del rl
        self.assertEqual(len(cm.output), 1)
        self.assertIn("Remaining=598", cm.output[0])

    async def test_timer_does_not_keep_object_alive(self):
        rl = RateLimitLogger()
        rl.log("char-detail", 12345, "600/15m", 599, "1")  # schedules a timer
        ref = weakref.ref(rl)
        del rl
        gc.collect()
        self.assertIsNone(ref())
