# Adapted from:
# https://github.com/AlbertoRFer/Static-ESI-skill-dump/blob/bac96b8297c6828cf2e06b870ebd4fd64b46025c/dump_skills.py
import asyncio
import json
from collections import deque
import itertools
import logging
from esi.esi import PublicESISession


async def amain():
    logging.basicConfig()
    logging.getLogger().setLevel(logging.DEBUG)
    formatter = logging.Formatter(
        "%(asctime)s|%(name)s|%(levelname)s|%(message)s|%(funcName)s:%(lineno)s"
    )
    logging.getLogger().handlers[0].setFormatter(formatter)

    async with PublicESISession("https://esi.evetech.net") as session:
        await do_work(session)


async def do_work(session):
    response = await session.get_item_category_information(16)

    category_order = [
        "Spaceship Command",
        "Navigation",
        "Engineering",
        "Subsystems",
        "Armor",
        "Shields",
        "Targeting",
        "Gunnery",
        "Missiles",
        "Drones",
        "Electronic Systems",
        "Scanning",
        "Rigging",
        "Social",
        "Fleet Support",
        "Corporation Management",
        "Trade",
        "Neural Enhancement",
        "Production",
        "Science",
        "Resource Processing",
        "Planet Management",
        "Structure Management",
    ]

    skill_ids = []
    groups = []
    skills = []
    groups_to_process = deque(response["groups"])

    async def processor_task():
        while True:
            try:
                group = groups_to_process.popleft()
            except IndexError:
                return
            if group == 505:  # "Fake Skills"
                continue
            response = await session.get_item_group_information(group)
            skill_ids.extend(response["types"])
            groups.append((group, response["name"]))

    await asyncio.gather(processor_task(), processor_task())

    def group_key(group):
        try:
            return category_order.index(group[1])
        except ValueError:
            return -1

    groups.sort(key=group_key)

    attrs = {
        val: idx
        for idx, val in enumerate(itertools.permutations((165, 166, 167, 168, 164), 2))
    }

    skill_ids = deque(skill_ids)

    async def processor_task():
        while True:
            try:
                skill_id = skill_ids.popleft()
            except IndexError:
                return

            data = await session.get_type_information(skill_id)
            if data["published"]:
                attribs = {
                    a["attribute_id"]: a["value"] for a in data["dogma_attributes"]
                }
                skills.append(
                    (
                        skill_id,
                        data["group_id"],
                        data["name"],
                        data["description"].replace("\r\n", "\n").strip(),
                        int(attribs[275]),
                        attrs[int(attribs[180]), int(attribs[181])],
                    )
                )

    await asyncio.gather(processor_task(), processor_task())

    skills.sort(key=lambda s: s[2])

    with open("src/skills.json", "w") as f:
        json.dump([groups, skills], fp=f, separators=(",", ":"))


def main():
    loop = asyncio.get_event_loop()
    try:
        return loop.run_until_complete(amain())
    finally:
        try:
            loop.run_until_complete(loop.shutdown_asyncgens())
        finally:
            loop.close()


if __name__ == "__main__":
    main()
