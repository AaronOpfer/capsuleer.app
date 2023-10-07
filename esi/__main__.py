import os
import ast
import json
import math
import time
import asyncio
import logging
import argparse
import datetime
import operator
import functools
import subprocess
import configparser

import aiohttp
import aiohttp.web
import aiohttp_session
from aiohttp.abc import AbstractAccessLogger
from aiohttp_session import get_session
from aiohttp_session.cookie_storage import EncryptedCookieStorage

from .db import Database
from .esi import ESISession
from .data import implant_type_id_to_learning_bonus
from .types import Character, ItemTypes, NoSuchCharacter, CharacterNeedsUpdated
from .isk_for_sp import get_isk_for_sp_options

logger = logging.getLogger(__name__)
dumps = functools.partial(json.dumps, separators=(",", ":"))

attribute_reducer = operator.itemgetter(
    "intelligence", "memory", "perception", "willpower", "charisma"
)


skill_reducer = operator.itemgetter(
    "skill_id", "trained_skill_level", "active_skill_level", "skillpoints_in_skill"
)


async def get_account_id(request):
    session = await get_session(request)
    try:
        return session["account_id"]
    except KeyError:
        raise aiohttp.web.HTTPUnauthorized() from None


def dateparse(incoming):
    return datetime.datetime.strptime(incoming, "%Y-%m-%dT%H:%M:%SZ").astimezone(
        datetime.UTC
    )


def skillqueue_reducer(item):
    if "start_date" in item:
        return [
            item["skill_id"],
            item["finished_level"],
            int(dateparse(item["start_date"]).timestamp()),
            int(dateparse(item["finish_date"]).timestamp()),
        ]
    else:
        return [item["skill_id"], item["finished_level"]]


class AccessLogger(AbstractAccessLogger):
    def log(self, request, response, time):
        if response.status >= 500:
            out = self.logger.error
        elif response.status >= 400:
            out = self.logger.warning
        else:
            out = self.logger.info

        try:
            ip = request.headers["X-Real-Ip"]
        except KeyError:
            ip = "???IP???"

        out(
            f"{ip} {response.status} {request.method} "
            f"{request.path} {time*1000:.3f}ms"
        )


def sessionify(f):
    async def wrapper(self, request):
        if "Origin" in request.headers:
            origin = request.headers["Origin"]
            if origin != self._base_url:
                logger.warning(
                    "Request sent from %s origin, refusing. %r", origin, request
                )
                return aiohttp.web.Response(status=400)

        try:
            char_id = int(request.match_info["char"])
        except ValueError:
            return aiohttp.web.Response(status=400)

        account_id = await get_account_id(request)
        try:
            session = await self.db.get_session(account_id, char_id)
            return await f(self, session, request)
        except CharacterNeedsUpdated:
            return aiohttp.web.Response(status=205)
        except NoSuchCharacter:
            return aiohttp.web.Response(status=404)

    return wrapper


class Server:
    __slots__ = (
        "_esi",
        "_client_id",
        "_cached_skill_trades",
        "_callback_source",
        "db",
        "_base_url",
        "_internal_account_id",
    )

    def __init__(
        self, base_url, esi_url, client_id, client_secret_key, internal_account_id
    ):
        self._base_url = base_url
        self._client_id = client_id
        self._esi = ESISession(esi_url, client_id, client_secret_key)
        self._cached_skill_trades = 0, None
        self._internal_account_id = internal_account_id

    async def esi_callback(self, request):
        session = await get_session(request)
        query = request.rel_url.query
        try:
            session_state = int(session.pop("state"))
        except (KeyError, ValueError, TypeError):
            return aiohttp.web.Response(status=400, text="missing/invalid state")

        if session_state != int(query["state"]):
            return aiohttp.web.Response(status=400)

        authz_code = request.rel_url.query["code"]
        access_token = await self._esi.get_access_token(authz_code)
        character, owner_hash = await self._esi.get_character(access_token)

        old_account_id = session.get("account_id")
        session["account_id"] = await self.db.character_authorized(
            old_account_id, character, access_token, owner_hash
        )
        logger.info(
            "character_authorized(%r, %r) => %r",
            old_account_id,
            character,
            session["account_id"],
        )
        raise aiohttp.web.HTTPFound(f"{self._base_url}/")

    async def auth_redirect(self, request):
        scopes = [
            "esi-skills.read_skills.v1",
            "esi-skills.read_skillqueue.v1",
            "esi-wallet.read_character_wallet.v1",
            "esi-clones.read_clones.v1",
            "esi-clones.read_implants.v1",
        ]
        try:
            account_id = await get_account_id(request)
            if account_id == self._internal_account_id:
                scopes.append("esi-markets.structure_markets.v1")
        except Exception:
            pass
        session = await get_session(request)
        session["state"] = int.from_bytes(os.urandom(8), "little")
        url = (
            "https://login.eveonline.com/oauth/authorize?"
            "response_type=code"
            "&redirect_uri=%s/callback"
            "&client_id=%s"
            "&scope=%s"
            "&state=%d"
        ) % (self._base_url, self._client_id, " ".join(scopes), session["state"])
        raise aiohttp.web.HTTPFound(url)

    async def logout(self, request):
        session = await get_session(request)
        session.clear()
        return aiohttp.web.HTTPFound("/")

    async def delete_character(self, request):
        if "Origin" in request.headers:
            origin = request.headers["Origin"]
            if origin != self._base_url:
                logger.warning(
                    "Request sent from %s origin, refusing. %r", origin, request
                )
                return aiohttp.web.Response(status=400)

        try:
            character_id = int(request.match_info["char"])
        except ValueError:
            return aiohttp.web.Response(status=400)

        account_id = await get_account_id(request)
        await self.db.delete_character(account_id=account_id, character_id=character_id)
        return aiohttp.web.Response(status=200)

    @sessionify
    async def wallet(self, session, request):
        journal = await self._esi.get_wallet_journal(session)
        now = datetime.datetime.now(datetime.UTC)
        time_until_expiry = math.floor((journal.expires - now).total_seconds())
        headers = {}
        if time_until_expiry > 0:
            headers["Cache-Control"] = f"private, max-age={time_until_expiry}"

        journal = [j for j in journal if j["amount"]]  # skip 0 ISK "fees"
        if not len(journal):
            return aiohttp.web.json_response((), dumps=dumps, headers=headers)

        string_table = {}

        def entry(the_str):
            try:
                return string_table[the_str]
            except KeyError:
                idx = len(string_table)
                string_table[the_str] = idx
                return idx

        first_date_int = int(dateparse(journal[0]["date"]).timestamp())
        etag = f'W/"{first_date_int}"'
        headers["ETag"] = etag
        if etag == request.headers.get("if-none-match"):
            raise aiohttp.web.HTTPNotModified

        reduced = [
            (
                first_date_int - int(dateparse(j["date"]).timestamp()),
                j["amount"],
                entry(j["description"]),
            )
            for j in journal
        ]

        return aiohttp.web.json_response(
            [
                journal[0]["balance"],
                first_date_int,
                tuple(string_table.keys()),
                reduced,
            ],
            headers=headers,
            dumps=dumps,
        )

    @sessionify
    async def skills(self, session, request):
        await self._esi.ensure_session(session)
        (
            skill_data,
            skill_queue,
            attributes,
            wallet_balance,
            implants,
        ) = await asyncio.gather(
            self._esi.get_skills(session),
            self._esi.get_skill_queue(session),
            self._esi.get_attributes(session),
            self._esi.get_wallet_balance(session),
            self._esi.get_implants(session),
        )

        earliest_expiry = min(
            x.expires
            for x in (skill_data, skill_queue, attributes, wallet_balance, implants)
        )

        wallet_balance = wallet_balance.result

        unallocated_sp = skill_data.get("unallocated_sp", 0)
        sp = skill_data["total_sp"] + unallocated_sp
        skills = tuple(map(skill_reducer, skill_data["skills"]))
        skill_queue = tuple(map(skillqueue_reducer, skill_queue))
        attributes = attribute_reducer(attributes)

        table = implant_type_id_to_learning_bonus
        implant_bonuses = [0, 0, 0, 0, 0]
        for implant_type_id in implants:
            try:
                attribute_id, magnitude = table[implant_type_id]
            except KeyError:
                continue
            # This is a slightly clever trick. we want to order attributes
            # INT MEM PER WIL CHR, but their IDs are ordered
            # CHR INT MEM PER WIL starting at 175. So, we subtract 176 so
            # that charisma will be -1 and placed at the end of the array.
            implant_bonuses[attribute_id - 176] += magnitude

        biology_implant = 0
        if ItemTypes.BY805.value in implants:
            biology_implant = 1
        elif ItemTypes.BY810.value in implants:
            biology_implant = 2

        headers = {}
        now = datetime.datetime.now().replace(tzinfo=datetime.UTC)
        time_until_expiry = math.floor((earliest_expiry - now).total_seconds())

        if time_until_expiry > 0:
            headers["Cache-Control"] = f"private, max-age={time_until_expiry}"

        return aiohttp.web.json_response(
            (
                sp,
                skill_queue,
                skills,
                attributes,
                wallet_balance,
                0,
                0,
                implant_bonuses,
                unallocated_sp,
                biology_implant,
            ),
            dumps=dumps,
            headers=headers,
        )

    async def _skill_trade_task(self):
        while True:
            try:
                characters, validity = await self.db.get_characters(
                    self._internal_account_id
                )
                if not characters:
                    raise Exception("No internal account characters!")
                character = characters[0]
                session = await self.db.get_session(
                    self._internal_account_id, character.id
                )
                data = await get_isk_for_sp_options(self._esi, session)
                expires = time.monotonic() + 30 * 60
                self._cached_skill_trades = expires, data
            except Exception:
                logging.exception("Error updating skill trade information")

            await asyncio.sleep(60 * 30)

    async def skill_trades(self, request):
        expires, data = self._cached_skill_trades
        while not data:
            await asyncio.sleep(1)
            expires, data = self._cached_skill_trades

        time_until_expiry = int(expires - time.monotonic())
        return aiohttp.web.json_response(
            data,
            dumps=dumps,
            headers={}
            if time_until_expiry < 0
            else {"Cache-Control": f"public, max-age={time_until_expiry}"},
        )

    async def _characters(self, request) -> tuple[int, list[Character], list[bool]]:
        account_id = await get_account_id(request)
        characters, validity = await self.db.get_characters(account_id)
        if not characters:
            # Prevent a weird "trap" where an account has no characters;
            # force the user to add another character by putting them
            # through the auth process again.
            raise aiohttp.web.HTTPUnauthorized() from None
        return account_id, characters, validity

    async def characters(self, request):
        _, characters, validity = await self._characters(request)
        return aiohttp.web.json_response(
            [(*c, v) for c, v in zip(characters, validity)], dumps=dumps
        )

    async def characters_training(self, request):
        account_id, characters, validity = await self._characters(request)
        fut_to_id = {
            asyncio.ensure_future(
                self._single_character_training(account_id, c.id)
            ): c.id
            for valid, c in zip(validity, characters)
            if valid
        }
        expected_count = len(fut_to_id)
        completed_count = 0
        transmitted_count = 0
        results_to_transmit = []
        all_done_future = asyncio.Future()

        def _on_complete(future):
            character_id = fut_to_id.pop(future)
            try:
                result = future.result()
            except CharacterNeedsUpdated:  # soften this for reporting purposes
                logger.info("character %d needs refresh token updated", character_id)
                result = None
            except asyncio.CancelledError:  # soften this for reporting purposes
                result = None
            except Exception:
                logger.exception("error downloading %d skill queue", character_id)
                result = None
            results_to_transmit.append((character_id, result))

            nonlocal completed_count
            completed_count += 1
            if completed_count == expected_count:
                all_done_future.set_result(None)

        for fut in fut_to_id.keys():
            fut.add_done_callback(_on_complete)

        response = aiohttp.web.StreamResponse(
            status=200, headers={"Content-Type": "text/plain"}
        )

        await response.prepare(request)

        try:
            while transmitted_count != expected_count:
                await asyncio.wait(
                    (asyncio.create_task(asyncio.sleep(0.2)), all_done_future),
                    return_when=asyncio.FIRST_COMPLETED,
                )
                going_to_transmit_count = len(results_to_transmit)
                if going_to_transmit_count:
                    response_segment = b""
                    for character_id, result in results_to_transmit:
                        response_segment += self._character_training_result(
                            character_id, result
                        )
                    results_to_transmit = []
                    await response.write(response_segment)
                    transmitted_count += going_to_transmit_count
                    logger.debug(
                        "transmitted %d/%d characters",
                        transmitted_count,
                        expected_count,
                    )

            await response.write_eof()
            return response
        except asyncio.CancelledError:
            for fut in fut_to_id.keys():
                fut.cancel()
            for fut in fut_to_id.keys():
                try:
                    await fut
                except asyncio.CancelledError:
                    pass
            raise

    async def _single_character_training(self, account_id, character_id):
        session = await self.db.get_session(account_id, character_id)
        queue = await self._esi.get_skill_queue(session)
        if not queue:
            return
        if "start_date" not in queue[0]:
            return
        current_time = datetime.datetime.now(datetime.UTC)
        for queue_item in queue:
            finish_date = dateparse(queue_item["finish_date"])
            if current_time < finish_date:
                break
        else:
            return

        return (
            queue_item["skill_id"],
            queue_item["finished_level"],
            queue_item["training_start_sp"],
            int(dateparse(queue_item["start_date"]).timestamp()),
            int(finish_date.timestamp()),
        )

    @staticmethod
    def _character_training_result(character_id, result):
        if result is None:
            return f"{character_id}\n".encode()
        skill_id, level, sp, started, ended = result
        return f"{character_id}:{skill_id}:{level}:{sp}:{started}:{ended}\n".encode()

    async def run(self, listen_sock_path, dbargs, cookie_secret_key):
        app = aiohttp.web.Application()
        app.add_routes(
            [
                aiohttp.web.get("/auth", self.auth_redirect),
                aiohttp.web.get("/callback", self.esi_callback),
                aiohttp.web.get("/characters", self.characters),
                aiohttp.web.get("/characters/training", self.characters_training),
                aiohttp.web.get(r"/{char:\d+}/skills", self.skills),
                aiohttp.web.get(r"/{char:\d+}/wallet", self.wallet),
                aiohttp.web.delete(r"/{char:\d+}", self.delete_character),
                aiohttp.web.get("/skilltrades", self.skill_trades),
                aiohttp.web.get("/logout", self.logout),
                aiohttp.web.get("/cause_an_error", raiser),
                aiohttp.web.static("/s", "static"),
            ]
        )
        aiohttp_session.setup(
            app,
            EncryptedCookieStorage(
                cookie_secret_key, cookie_name="s", max_age=60 * 60 * 24 * 30  # 30 days
            ),
        )
        async with Database(**dbargs) as self.db, self._esi:
            task = asyncio.get_event_loop().create_task(self._skill_trade_task())
            runner = aiohttp.web.AppRunner(
                app, handle_signals=True, access_log_class=AccessLogger
            )
            try:
                await runner.setup()
                site = aiohttp.web.UnixSite(runner, listen_sock_path)
                await site.start()
                subprocess.run(["setfacl", "-m", "u:www-data:rwx", listen_sock_path])
                while True:
                    await task
            finally:
                await runner.cleanup()


async def raiser():
    raise RuntimeError("It raised")


def setup_sentry(dsn):
    logger.debug("setting up sentry with dsn %s", dsn)
    import sentry_sdk
    from sentry_sdk.integrations.aiohttp import AioHttpIntegration

    sentry_sdk.init(dsn=dsn, integrations=[AioHttpIntegration()])
    logger.info("sentry initialization successful")


async def amain():
    parser = argparse.ArgumentParser(description="ESI App")
    parser.add_argument("configuration_file", type=str)
    logging.basicConfig()
    logging.getLogger().setLevel(logging.INFO)
    formatter = logging.Formatter(
        "%(asctime)s|%(name)s|%(levelname)s|%(message)s|%(funcName)s:%(lineno)s"
    )
    logging.getLogger().handlers[0].setFormatter(formatter)
    result = parser.parse_args()
    config = configparser.ConfigParser()
    config.read(result.configuration_file)

    try:
        new_level = config["misc"]["log_level"]
    except KeyError:
        pass
    else:
        logging.getLogger().setLevel(logging.getLevelName(new_level))
        logger.info("loglevel set to %s", new_level)

    try:
        sentry_dsn = config["sentry"]["dsn"]
    except KeyError:
        pass
    else:
        setup_sentry(sentry_dsn)

    server = Server(
        config["http"]["base_url"],
        config["esi"]["esi_url"],
        config["esi"]["client_id"],
        config["esi"]["client_secret_key"],
        int(config["esi"]["internal_account_id"]),
    )
    await server.run(
        config["http"]["listen_socket"],
        config["database"],
        ast.literal_eval(config["http"]["cookie_secret_key"]),
    )


def main():
    asyncio.run(amain())


if __name__ == "__main__":
    main()
