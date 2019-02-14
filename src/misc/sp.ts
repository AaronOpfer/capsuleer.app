export const attribute_names = Object.freeze([
    "intelligence",
    "memory",
    "perception",
    "willpower",
    "charisma",
]);

export const attribute_types = Object.freeze([
    "intelligence/memory",
    "intelligence/perception",
    "intelligence/willpower",
    "intelligence/charisma",
    "memory/intelligence",
    "memory/perception",
    "memory/willpower",
    "memory/charisma",
    "perception/intelligence",
    "perception/memory",
    "perception/willpower",
    "perception/charisma",
    "willpower/intelligence",
    "willpower/memory",
    "willpower/perception",
    "willpower/charisma",
    "charisma/intelligence",
    "charisma/memory",
    "charisma/perception",
    "charisma/willpower",
]);

export function sp_required(level: number, rank: number): number {
    if (level < 0 || level > 5) {
        throw Error();
    }
    return [0, 250, 1414, 8000, 45254, 256000][level] * rank;
}
