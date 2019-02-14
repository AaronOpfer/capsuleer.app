import asyncio

from esi.esi import PublicESISession


async def amain():
    output = {}
    async with PublicESISession("https://esi.evetech.net") as esi:
        type_ids = (await esi.get_item_group_information(300))["types"]
        type_ids += (await esi.get_item_group_information(745))["types"]

        for type_id in type_ids:
            type_info = await esi.get_type_information(type_id)
            if not type_info["published"]:
                continue
            dogma = {
                i["attribute_id"]: i["value"] for i in type_info["dogma_attributes"]
            }
            interesting_dogma = [
                [k, int(v)] for k, v in dogma.items() if k in range(175, 180) and v
            ]
            if interesting_dogma:
                if len(interesting_dogma) > 1:
                    raise RuntimeError("Unexpected output")
                output[type_id] = interesting_dogma[0]

    print(output)


asyncio.run(amain())
