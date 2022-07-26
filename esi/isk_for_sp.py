import operator
import logging
import datetime
from typing import Tuple, List

from .esi import ESISession
from .types import FileSession, JSONDict, ItemTypes, AcceleratorInfo


logger = logging.getLogger(__name__)


get_accel_magnitudes = operator.itemgetter(*range(175, 180))


async def get_isk_for_sp_options(
    esi: ESISession,
) -> Tuple[float, float, List[AcceleratorInfo]]:
    now = datetime.datetime.utcnow().timestamp()
    with JSONDict("npc_token") as jsondict:
        fs = FileSession(jsondict)

        citadel_ids = await esi.get_forge_market_citadel_ids()
        lsi_price = await esi.get_best_price(
            fs, "sell", citadel_ids, 10000002, ItemTypes.LargeSkillInjector.value
        )
        ssi_price = await esi.get_best_price(
            fs, "sell", citadel_ids, 10000002, ItemTypes.SmallSkillInjector.value
        )

        accelerators = []

        accel_type_ids = (await esi.get_market_group(2487))["types"]
        logger.info(
            "Cerebral Accelerator search yielded %d results", len(accel_type_ids)
        )
        for item_type_id in accel_type_ids:
            res = await esi.get_type_information(item_type_id)
            res = res.result
            if res["published"] != True:
                logger.info("UNPUBLISHED Type ID %d => %s", item_type_id, res["name"])
                continue
            if "Expired" in res["name"]:
                logger.info("EXPIRED Type ID %d => %s", item_type_id, res["name"])
                continue
            if res.get("market_group_id") != 2487:  # should be unreachable now...
                logger.info(
                    "NOT IN MARKET 2487 (actually in %r) Type ID %d => %s",
                    res.get("market_group_id"),
                    item_type_id,
                    res["name"],
                )
                continue
            if "dogma_attributes" not in res:
                logger.info("NO DOGMA Type ID %d => %s", item_type_id, res["name"])
                # I think this is caused by recent expiration?
                continue
            dogma = res["dogma_attributes"] = {
                i["attribute_id"]: i["value"] for i in res["dogma_attributes"]
            }
            try:
                magnitudes = get_accel_magnitudes(dogma)
            except KeyError:
                logger.info("NO MAGNITUDES Type ID %d => %s", item_type_id, res["name"])
                continue
            if magnitudes.count(magnitudes[0]) != len(magnitudes):
                logger.info(
                    "INCORRECT MAGNITUDES Type ID %d => %s", item_type_id, res["name"]
                )
                continue
            duration = dogma[330]

            if item_type_id not in (
                ItemTypes.MasterAtArms.value,
                ItemTypes.Expert.value,
            ):
                try:
                    expiry = dogma[2422]
                except KeyError:
                    logger.info("NO EXPIRY Type ID %d => %s", item_type_id, res["name"])
                    continue  # expired

                if now > expiry * (24 * 60 * 60):
                    logger.info("EXPIRED Type ID %d => %s", item_type_id, res["name"])
                    continue  # expired

            price = await esi.get_best_price(
                fs, "sell", citadel_ids, 10000002, item_type_id
            )

            if price is None:
                # Not available
                logger.info("NO PRICES Type ID %d => %s", item_type_id, res["name"])
                continue

            accelerators.append(
                AcceleratorInfo(
                    item_type_id, price, res["name"], magnitudes[0], duration / 1000
                )
            )
            logger.info(
                "Found +%d x %dsec accelerator: %d %s for %.2f ISK"
                % (magnitudes[0], duration / 1000, item_type_id, res["name"], price)
            )

        return lsi_price, ssi_price, accelerators
