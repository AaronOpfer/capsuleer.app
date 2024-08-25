import asyncio

from capsuleerapp.esi import PublicESISession


async def amain():
    esi = PublicESISession("https://esi.evetech.net")
    stations = set()
    async with esi:
        forge_consts = (await esi.get_region_information(10000002))["constellations"]
        for cid in forge_consts:
            const = await esi.get_constellation_information(cid)
            for system_id in const["systems"]:
                system = await esi.get_system_information(system_id)
                if "stations" not in system:
                    print("no stations in", system["name"])
                    continue
                print(len(system["stations"]), "stations in", system["name"])
                stations |= set(system["stations"])

    print(repr(stations))


asyncio.run(amain())
