export const attribute_names = Object.freeze([
    "intelligence",
    "memory",
    "perception",
    "willpower",
    "charisma",
]);

export const attribute_indexes = Object.freeze([
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 0],
    [1, 2],
    [1, 3],
    [1, 4],
    [2, 0],
    [2, 1],
    [2, 3],
    [2, 4],
    [3, 0],
    [3, 1],
    [3, 2],
    [3, 4],
    [4, 0],
    [4, 1],
    [4, 2],
    [4, 3],
]);

export function sp_per_minute(attributes: number[], attribute_type: number): number {
    const [lh, rh] = attribute_indexes[attribute_type];
    return attributes[lh] + attributes[rh] / 2;
}

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

export const attribute_bitmasks = Object.freeze([
    // int
    0b11000, 0b10100, 0b10010, 0b10001,
    // mem
    0b11000, 0b01100, 0b01010, 0b01001,
    // per
    0b10100, 0b01100, 0b00110, 0b00101,
    // wil
    0b10010, 0b01010, 0b00110, 0b00011,
    //char
    0b10001, 0b01001, 0b00101, 0b00011,
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
    for (;;) {
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
