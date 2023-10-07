import abc
import enum
import json
import asyncio
import logging
import datetime
from typing import NamedTuple
from operator import attrgetter
from collections import deque
from email.utils import parsedate_to_datetime

logger = logging.getLogger(__name__)


class AccessToken(NamedTuple):
    access_token: str
    expired_after: datetime.datetime
    refresh_token: str


class Character(NamedTuple):
    id: int
    name: str
    valid: bool


class AcceleratorInfo(NamedTuple):
    id: int
    price: float
    name: str
    magnitude: int
    duration: float


class ItemTypes(enum.Enum):
    MasterAtArms = 48582
    Expert = 55826
    LargeSkillInjector = 40520
    SmallSkillInjector = 45635
    BY805 = 27147
    BY810 = 27148


class NoTokenAvailable(KeyError):
    pass


class RefreshTokenError(Exception):
    pass


class CharacterNeedsUpdated(Exception):
    pass


class NoSuchCharacter(Exception):
    pass


class JSONDict:
    __slots__ = "_data", "_filename", "_file"

    def __init__(self, filename):
        self._filename = filename

    def __enter__(self):
        self._open_file()
        self._data = json.load(self._file)
        logging.info("Loaded file session")
        return self

    def __exit__(self, a, b, c):
        self._file.close()
        self._file = None

    def __del__(self):
        if self._file:
            self._file.close()

    def _open_file(self):
        self._file = open(self._filename)

    def __setitem__(self, key, value):
        self._data[key] = value
        logging.info("File session modified: %s => %r", key, value)
        self._file.close()
        try:
            with open(self._filename, "w") as f:
                json.dump(self._data, f)
        finally:
            self._open_file()

    def __getitem__(self, key):
        return self._data[key]


class ABCSession(metaclass=abc.ABCMeta):
    __slots__ = ()

    @property
    @abc.abstractmethod
    def access_token(self) -> AccessToken:
        pass

    @abc.abstractmethod
    async def set_access_token(self, new_token: AccessToken | None):
        pass

    @property
    @abc.abstractmethod
    def character(self) -> Character:
        pass


class Response:
    __slots__ = "_result", "_expires", "_last_modified", "headers", "_date"

    __getitem__ = property(attrgetter("_result.__getitem__"))
    __len__ = property(attrgetter("_result.__len__"))
    __iter__ = property(attrgetter("_result.__iter__"))
    result = property(attrgetter("_result"))
    get = property(attrgetter("_result.get"))

    def __init__(self, json_body, response_object):
        self._expires = response_object.headers["Expires"]
        self._date = response_object.headers["Date"]
        self._last_modified = response_object.headers["Last-Modified"]
        self.headers = response_object.headers
        self._result = json_body

    def __repr__(self):
        return f"Response({self._result!r})"

    @property
    def date(self):
        date = self._date
        if type(date) is datetime.datetime:
            return date

        date = parsedate_to_datetime(date)
        self._date = date
        return date

    @property
    def expires(self):
        expires = self._expires
        if type(expires) is datetime.datetime:
            return expires

        expires = parsedate_to_datetime(expires)
        self._expires = expires
        return expires

    @property
    def last_modified(self):
        last_modified = self._last_modified
        if type(last_modified) is datetime.datetime:
            return last_modified

        last_modified = parsedate_to_datetime(last_modified)
        self._last_modified = last_modified
        return last_modified


class ESILimiter:
    def __init__(self):
        self._limit: int = 1
        self._occupancy = 0
        self._waiters: deque[asyncio.Future] = deque()
        self._loop = asyncio.get_running_loop()
        self._done_fut = self._loop.create_future()
        self._done_fut.set_result(None)
        self._reset_timer: asyncio.TimerHandle | None = None
        # pick a really old day for the sake of my unit tests.
        self._previous_response_dt = datetime.datetime(
            year=2019, month=1, day=1, tzinfo=datetime.timezone.utc
        )

    if __debug__:

        @property
        def _occupancy(self):
            return self.__occupancy

        @_occupancy.setter
        def _occupancy(self, new_value: int):
            assert new_value >= 0
            assert isinstance(new_value, int)
            self.__occupancy = new_value

    def __aenter__(self) -> None:
        limit = self._limit
        occupancy = self._occupancy

        if occupancy < limit:
            self._occupancy += 1
            return self._done_fut

        waiter = self._loop.create_future()
        self._waiters.append(waiter)
        return waiter
        # We don't increment occupancy; the resolver of the waiter
        # future does this for us.

    def _unblock_waiters(self) -> None:
        while self._waiters and self._occupancy < self._limit:
            wait_fut = self._waiters.popleft()
            if not wait_fut.done():
                wait_fut.set_result(None)
                self._occupancy += 1

    def __aexit__(self, exc_type, exc, tb) -> None:
        self._occupancy -= 1
        self._unblock_waiters()
        return self._done_fut

    def set_remaining(
        self,
        response_dt: datetime.datetime,
        remaining: int,
        timeout: float | None = None,
    ) -> None:
        assert response_dt.tzinfo
        if response_dt < self._previous_response_dt:
            return
        self._previous_response_dt = response_dt
        new_limit = remaining  # - 1
        previous_limit = self._limit
        if previous_limit == new_limit:
            return
        logger.info(
            "ESI ERROR LIMIT: %d -> %d",
            previous_limit,
            new_limit,
        )
        self._limit = new_limit

        if new_limit > previous_limit:
            self._unblock_waiters()
        if timeout is not None:
            if self._reset_timer is not None:
                self._reset_timer.cancel()
                self._reset_timer = None
            self._reset_timer = self._loop.call_later(timeout, self._on_timeout)

    def _on_timeout(self):
        if self._limit < 1:
            self._limit = 1
            logger.info("ESI ERROR LIMIT: reset timeout reached, increasing limit to 1")
            self._unblock_waiters()
