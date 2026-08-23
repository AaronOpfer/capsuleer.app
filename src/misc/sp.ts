// Which pair of attributes governs a skill's training rate (primary/secondary). Values match
// the `attribute` field CCP's SDE assigns each skill, as encoded by dump_skills.py.
export enum AttributePair {
    IntelligenceMemory = 0,
    IntelligencePerception = 1,
    IntelligenceWillpower = 2,
    IntelligenceCharisma = 3,
    MemoryIntelligence = 4,
    MemoryPerception = 5,
    MemoryWillpower = 6,
    MemoryCharisma = 7,
    PerceptionIntelligence = 8,
    PerceptionMemory = 9,
    PerceptionWillpower = 10,
    PerceptionCharisma = 11,
    WillpowerIntelligence = 12,
    WillpowerMemory = 13,
    WillpowerPerception = 14,
    WillpowerCharisma = 15,
    CharismaIntelligence = 16,
    CharismaMemory = 17,
    CharismaPerception = 18,
    CharismaWillpower = 19,
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

// Position of each individual attribute within an `attributes: number[]` tuple, as used
// throughout this module and by CharacterSkills.attributes.
export enum Attribute {
    Intelligence = 0,
    Memory = 1,
    Perception = 2,
    Willpower = 3,
    Charisma = 4,
}

export const attribute_indexes = Object.freeze([
    [Attribute.Intelligence, Attribute.Memory],
    [Attribute.Intelligence, Attribute.Perception],
    [Attribute.Intelligence, Attribute.Willpower],
    [Attribute.Intelligence, Attribute.Charisma],
    [Attribute.Memory, Attribute.Intelligence],
    [Attribute.Memory, Attribute.Perception],
    [Attribute.Memory, Attribute.Willpower],
    [Attribute.Memory, Attribute.Charisma],
    [Attribute.Perception, Attribute.Intelligence],
    [Attribute.Perception, Attribute.Memory],
    [Attribute.Perception, Attribute.Willpower],
    [Attribute.Perception, Attribute.Charisma],
    [Attribute.Willpower, Attribute.Intelligence],
    [Attribute.Willpower, Attribute.Memory],
    [Attribute.Willpower, Attribute.Perception],
    [Attribute.Willpower, Attribute.Charisma],
    [Attribute.Charisma, Attribute.Intelligence],
    [Attribute.Charisma, Attribute.Memory],
    [Attribute.Charisma, Attribute.Perception],
    [Attribute.Charisma, Attribute.Willpower],
]);

export function sp_per_minute(attributes: number[], attribute_type: AttributePair): number {
    const [primary, secondary] = attribute_indexes[attribute_type];
    return attributes[primary] + attributes[secondary] / 2;
}

// One bit per attribute (intelligence/memory/perception/willpower/charisma, high to low)
// indicating which attributes a given attribute_type's rate depends on.
export const attribute_bitmasks = Object.freeze([
    // intelligence/*
    0b11000, 0b10100, 0b10010, 0b10001,
    // memory/*
    0b11000, 0b01100, 0b01010, 0b01001,
    // perception/*
    0b10100, 0b01100, 0b00110, 0b00101,
    // willpower/*
    0b10010, 0b01010, 0b00110, 0b00011,
    // charisma/*
    0b10001, 0b01001, 0b00101, 0b00011,
]);

export function sp_required(level: number, rank: number): number {
    if (level < 0 || level > 5) {
        throw Error();
    }
    return [0, 250, 1414, 8000, 45254, 256000][level] * rank;
}

function large_skill_injector_effectiveness(sp: number): number {
    if (sp < 5000000) {
        return 500000;
    } else if (sp < 50000000) {
        return 400000;
    } else if (sp < 80000000) {
        return 300000;
    }
    return 150000;
}

export function calculate_number_of_injectors(
    sp: number,
    unallocated_sp: number,
    desired: number,
): number {
    desired -= unallocated_sp;
    if (desired <= 0) {
        return 0;
    }
    let injectors = 0;
    for (;;) {
        const si_effectiveness = large_skill_injector_effectiveness(sp);
        if (desired < si_effectiveness) {
            injectors += desired / si_effectiveness;
            return injectors;
        }
        injectors += 1;
        desired -= si_effectiveness;
        sp += si_effectiveness;
    }
}

// How much SP `count` Large Skill Injectors would add to a character currently at `sp` total
// skill points. Each injector's effectiveness depends on the character's total SP *at the time
// it's consumed*, so this recomputes the tier after every injector rather than assuming they
// all land in the tier `sp` started in.
export function sp_from_injectors(sp: number, count: number): number {
    let total_gained = 0;
    for (let i = 0; i < count; i++) {
        total_gained += large_skill_injector_effectiveness(sp + total_gained);
    }
    return total_gained;
}
