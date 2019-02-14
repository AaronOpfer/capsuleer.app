from typing import NamedTuple
from email.utils import parsedate_to_datetime
import abc
import datetime
import enum
import json
import asyncio
import logging
from operator import attrgetter

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
    async def set_access_token(self, new_token: AccessToken):
        pass

    @property
    @abc.abstractmethod
    def character(self) -> AccessToken:
        pass

    @character.setter
    @abc.abstractmethod
    def character(self, new_character: Character):
        pass

    @abc.abstractmethod
    async def lock_for_token_update(self):
        pass


class FileSession(ABCSession):
    __slots__ = "_session", "_lock"

    def __init__(self, session):
        self._session = session
        self._lock = asyncio.Lock()

    @property
    def access_token(self) -> AccessToken:
        try:
            token = self._session["access_token"]
        except KeyError:
            raise NoTokenAvailable() from None
        return AccessToken(
            token[0], datetime.datetime.fromtimestamp(token[1]), token[2]
        )

    async def set_access_token(self, new_token: AccessToken):
        self._session["access_token"] = [
            new_token[0],
            new_token[1].timestamp(),
            new_token[2],
        ]

    @property
    def character(self):
        return Character._make(self._session["character"])

    @character.setter
    def character(self, new_character: Character):
        self._session["character"] = new_character

    async def lock_for_token_update(self):
        return self._lock


class Response:
    __slots__ = "_result", "_expires", "_last_modified", "headers"

    __getitem__ = property(attrgetter("_result.__getitem__"))
    __len__ = property(attrgetter("_result.__len__"))
    __iter__ = property(attrgetter("_result.__iter__"))
    result = property(attrgetter("_result"))
    get = property(attrgetter("_result.get"))

    def __init__(self, json_body, response_object):
        self._expires = response_object.headers["Expires"]
        self._last_modified = response_object.headers["Last-Modified"]
        self.headers = response_object.headers
        self._result = json_body

    def __repr__(self):
        return f"Response({self._result!r})"

    @property
    def expires(self):
        expires = self._expires
        if type(expires) is datetime.datetime:
            return expires

        expires = parsedate_to_datetime(expires)
        self._expires = expires
        return expires

    @property
    def last_modified(self):  # FIXME copy and paste of the above
        last_modified = self._last_modified
        if type(last_modified) is datetime.datetime:
            return last_modified

        last_modified = parsedate_to_datetime(last_modified)
        self._last_modified = last_modified
        return last_modified
