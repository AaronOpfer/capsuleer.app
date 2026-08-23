import {expect, test} from "vitest";
import {
    attribute_bitmasks,
    attribute_types,
    calculate_number_of_injectors,
    sp_from_injectors,
    sp_per_minute,
    AttributePair,
} from "./sp";

test("sp_per_minute uses primary attribute fully and secondary at half", () => {
    expect(attribute_types[AttributePair.PerceptionWillpower]).toBe("perception/willpower");
    const attributes = [20, 20, 27, 21, 20]; // int, mem, per, wil, cha
    expect(sp_per_minute(attributes, AttributePair.PerceptionWillpower)).toBe(27 + 21 / 2);
});

test("attribute_bitmasks matches each attribute_type's primary/secondary pair", () => {
    const bit = {
        intelligence: 0b10000,
        memory: 0b01000,
        perception: 0b00100,
        willpower: 0b00010,
        charisma: 0b00001,
    };
    expect(attribute_bitmasks[attribute_types.indexOf("intelligence/memory")]).toBe(
        bit.intelligence | bit.memory,
    );
    expect(attribute_bitmasks[attribute_types.indexOf("perception/willpower")]).toBe(
        bit.perception | bit.willpower,
    );
    expect(attribute_bitmasks[attribute_types.indexOf("charisma/willpower")]).toBe(
        bit.charisma | bit.willpower,
    );
    expect(attribute_bitmasks).toHaveLength(attribute_types.length);
});

test("sp_from_injectors uses the same effectiveness tier as calculate_number_of_injectors", () => {
    expect(sp_from_injectors(1000000, 1)).toBe(500000);
    expect(sp_from_injectors(10000000, 1)).toBe(400000);
    expect(sp_from_injectors(60000000, 1)).toBe(300000);
    expect(sp_from_injectors(90000000, 1)).toBe(150000);
    expect(sp_from_injectors(1000000, 3)).toBe(1500000);
});

test("sp_from_injectors and calculate_number_of_injectors round-trip", () => {
    const sp = 1000000;
    const gained = sp_from_injectors(sp, 4);
    expect(calculate_number_of_injectors(sp, 0, gained)).toBeCloseTo(4);
});

test("sp_from_injectors drops to the next tier's effectiveness once a threshold is crossed", () => {
    // Starting just under the 5M threshold: the first injector is still worth 500k (bringing
    // the total to 5.4M), but the second is worth only 400k, since it's consumed *after*
    // crossing 5M SP — not 500k again, as a naive "hold the starting tier fixed" calc would say.
    expect(sp_from_injectors(4900000, 1)).toBe(500000);
    expect(sp_from_injectors(4900000, 2)).toBe(500000 + 400000);
});

test("calculate_number_of_injectors accounts for dropping to the next tier partway through", () => {
    // Mirrors the sp_from_injectors case above: needing the SP that 2 tier-crossing injectors
    // provide should require exactly 2 injectors, not slightly fewer (as it would if the
    // calculation kept assuming the cheaper starting tier's effectiveness throughout).
    expect(calculate_number_of_injectors(4900000, 0, 900000)).toBeCloseTo(2);
});
