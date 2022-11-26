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
export function calculate_number_of_injectors(
    sp: number,
    unallocated_sp: number,
    desired: number
): number {
    desired -= unallocated_sp;
    if (desired <= 0) {
        return 0;
    }
    let injectors = 0;
    while (true) {
        let si_effectiveness = 150000;
        if (sp < 5000000) {
            si_effectiveness = 500000;
        } else if (sp < 50000000) {
            si_effectiveness = 400000;
        } else if (sp < 80000000) {
            si_effectiveness = 300000;
        }
        if (desired < si_effectiveness) {
            injectors += desired / si_effectiveness;
            return injectors;
        }
        injectors += 1;
        desired -= si_effectiveness;
    }
}
