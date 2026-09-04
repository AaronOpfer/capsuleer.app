import datetime
import unittest

from capsuleerapp.types import ESIRequestFailure, is_esi_downtime


class TestIsESIDowntime(unittest.TestCase):
    def test_during_downtime(self):
        self.assertTrue(
            is_esi_downtime(
                datetime.datetime(2026, 9, 4, 11, 15, 0, tzinfo=datetime.UTC)
            )
        )

    def test_outside_downtime(self):
        self.assertFalse(
            is_esi_downtime(
                datetime.datetime(2026, 9, 4, 12, 0, 0, tzinfo=datetime.UTC)
            )
        )


class TestESIRequestFailureLikelyDowntime(unittest.TestCase):
    def test_flag_set_when_true(self):
        exc = ESIRequestFailure._make(503, "http://esi/foo", True)
        self.assertTrue(exc.likely_downtime)

    def test_flag_unset_when_false(self):
        exc = ESIRequestFailure._make(503, "http://esi/foo", False)
        self.assertFalse(exc.likely_downtime)
