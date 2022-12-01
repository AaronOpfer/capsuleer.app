import {skill_data} from "./static_skill_data";
import {CharacterSkills, CharacterSkillQueueItem} from "./character_skills";
import {sp_required, sp_per_minute} from "./misc/sp";

const BEST_IMPLANT_BONUS = 7.5;
const IMPLANT_BONUSES = [0.0, 1.5, 3.0, 4.5, 6.0, 7.5];

export interface AttributeMapping {
    attributes: number[];
    duration_implants: number[];
}

export interface OptimizationResults {
    current: AttributeMapping;
    best: AttributeMapping;
    best_mapping_sp_allocations: SPAllocation[];
}

export interface SPAllocation {
    id: number;
    level: number;
    sp: number;
}

export function get_sp_rate_information(
    relevant_attributes: Set<number>,
    attributes: number[],
    implant_bonus: number
) {
    let sp_per_second_by_attribute: {[attribute: number]: number} = {};
    // clever trick: we know what the possible rates are: slowest possible rate is 25.5
    // and fastest possible is 45. so multiply by two to remove floating points, subtract
    // 51, and reserve 90-51 = 40 empty spaces. Then, we place attributes with that speed
    // into that bucket. We later drop the missing buckets. As a result, we have sorted
    // sets of buckets of attributes in order of slowest to fastest.
    let sp_rates: Set<number>[] = Array.apply(null, Array(40)).map(() => new Set());

    for (const attribute of relevant_attributes) {
        const sp_rate = sp_per_minute(attributes, attribute) + implant_bonus;
        sp_rates[+(sp_rate * 2) - 51].add(attribute);
        sp_per_second_by_attribute[attribute] = sp_rate / 60;
    }
    sp_rates = sp_rates.filter((x) => x.size);
    return {sp_rates, sp_per_second_by_attribute};
}

function _perform_sp_allocations(
    unallocated_sp: number,
    sp_rates: Set<number>[],
    data: CharacterSkills
) {
    let sp_allocations: SPAllocation[] = [];
    let sp_allocation_mapping: {[index: number]: SPAllocation | undefined} = {};
    if (unallocated_sp) {
        // Apply unallocated SP
        for (const slow_attributes of sp_rates) {
            for (const {id: skill_id, level: training_level} of data.skill_queue) {
                const {rank, attribute} = skill_data.skill(skill_id);
                if (!slow_attributes.has(attribute)) {
                    continue;
                }
                const {sp: trained_sp, trained_level} = data.skills[skill_id];
                const sp_to_finish =
                    sp_required(training_level, rank) -
                    Math.max(trained_sp, sp_required(training_level - 1, rank));
                const allocation = {
                    id: skill_id,
                    level: training_level,
                    sp: Math.min(sp_to_finish, unallocated_sp),
                };
                sp_allocations.push(allocation);
                sp_allocation_mapping[skill_id * 10 + training_level] = allocation;
                unallocated_sp -= allocation.sp;
                if (!unallocated_sp) {
                    break;
                }
            }
            if (!unallocated_sp) {
                break;
            }
        }
    }
    return {sp_allocations, sp_allocation_mapping};
}

function sets_equal<Type>(left: Set<Type>, right: Set<Type>): boolean {
    if (left.size !== right.size) return false;
    return [...left].every((value) => right.has(value));
}

function hash_set(the_set: Set<number>): number {
    let hash = 0;
    let index = 1;
    for (const number of the_set) {
        hash ^= index * number;
        index += 1;
    }
    return hash;
}

function hash_list_of_sets(sets: Set<number>[]): number {
    let hash = 0;
    let index = 1;
    for (const set of sets) {
        hash ^= index * hash_set(set);
        index += 1;
    }
    return hash;
}

let _cache_charid: number = 0;
let _cache_unalloc: number = 0;
let _cache: Map<Number, [Set<number>[], ReturnType<typeof _perform_sp_allocations>][]> = new Map();
let _hit = 0;
let _miss = 0;

function perform_sp_allocations(
    unallocated_sp: number,
    sp_rates: Set<number>[],
    data: CharacterSkills
) {
    if (unallocated_sp === 0) {
        return {sp_allocations: [], sp_allocation_mapping: new Map()};
    }
    if (_cache_charid !== data.character_id || _cache_unalloc !== unallocated_sp) {
        _cache = new Map();
        _cache_charid = data.character_id;
        _cache_unalloc = unallocated_sp;
    }
    const cache_key = hash_list_of_sets(sp_rates);
    let cache;
    if (_cache.has(cache_key)) {
        cache = _cache.get(cache_key);
    } else {
        cache = [];
        _cache.set(cache_key, cache);
    }

    let cache_index = 0;

    for (const cache_entry of cache) {
        if (sp_rates.length === cache_entry[0].length) {
            const considered_attr_sets = cache_entry[0];
            if (sp_rates.every((r, i) => sets_equal(r, considered_attr_sets[i]))) {
                _hit += 1;
                return cache_entry[1];
            }
        }
        cache_index += 1;
    }
    let res = _perform_sp_allocations(unallocated_sp, sp_rates, data);
    cache.splice(0, 0, [sp_rates, res]);
    _miss += 1;
    return res;
}

export function* iter_queue_duration(
    data: CharacterSkills,
    attributes: number[],
    implant_bonus: number
) {
    let duration = 0; // seconds

    const relevant_attributes = new Set<number>();
    for (const {id: skill_id} of data.skill_queue) {
        relevant_attributes.add(skill_data.skill(skill_id).attribute);
    }
    const {sp_rates, sp_per_second_by_attribute} = get_sp_rate_information(
        relevant_attributes,
        attributes,
        implant_bonus
    );
    let unallocated_sp = data.unallocated_sp;

    const {sp_allocations, sp_allocation_mapping} = perform_sp_allocations(
        unallocated_sp,
        sp_rates,
        data
    );

    for (const {id: skill_id, level: training_level} of data.skill_queue) {
        const {sp: trained_sp, trained_level} = data.skills[skill_id];
        const {rank, attribute} = skill_data.skill(skill_id);
        const sp_per_second = sp_per_second_by_attribute[attribute];
        const allocation = sp_allocation_mapping[skill_id * 10 + training_level];
        const sp_in_skill = trained_sp + (allocation === undefined ? 0 : allocation.sp);
        const sp_to_finish =
            sp_required(training_level, rank) -
            Math.max(sp_in_skill, sp_required(training_level - 1, rank));
        duration += sp_to_finish / sp_per_second;
        yield {sp_allocations, duration};
    }
}

export function calculate_queue_duration(
    data: CharacterSkills,
    attributes: number[],
    implant_bonus: number
): {sp_allocations: SPAllocation[]; duration: number} {
    let duration = 0;
    let sp_allocations: SPAllocation[] = [];
    for ({sp_allocations, duration} of iter_queue_duration(data, attributes, implant_bonus));
    return {sp_allocations, duration};
}

export function optimize(data: CharacterSkills): OptimizationResults {
    let result: Partial<OptimizationResults> = {
        current: {
            duration_implants: [],
            attributes: data.base_attributes,
        },
        best: {
            duration_implants: [],
            attributes: [],
        },
        best_mapping_sp_allocations: [],
    };
    let best_duration;
    let best_attributes = data.base_attributes;
    IMPLANT_BONUSES.map((bonus) => {
        const {sp_allocations, duration} = calculate_queue_duration(
            data,
            data.base_attributes,
            bonus
        );
        result.current!.duration_implants!.push(duration);
        best_duration = duration;
        result.best_mapping_sp_allocations = sp_allocations;
    });

    for (let intelligence = 17; intelligence <= 27; intelligence++) {
        const max_memory = Math.min(48 - intelligence, 27);
        for (let memory = 17; memory <= max_memory; memory++) {
            const max_perception = Math.min(65 - intelligence - memory, 27);
            for (let perception = 17; perception <= max_perception; perception++) {
                const max_willpower = Math.min(82 - intelligence - memory - perception, 27);
                for (let willpower = 17; willpower <= max_willpower; willpower++) {
                    const all_but_one_sum = perception + memory + intelligence + willpower;
                    if (all_but_one_sum < 72) {
                        continue;
                    }
                    const charisma = 99 - all_but_one_sum;
                    if (perception + memory + intelligence + willpower + charisma != 99) {
                        // only accept solutions where we max out the attributes.
                        continue;
                    }
                    let current_attributes = [
                        intelligence,
                        memory,
                        perception,
                        willpower,
                        charisma,
                    ];
                    let current_duration = 0;
                    let current_sp_allocations: SPAllocation[] = [];
                    for ({
                        sp_allocations: current_sp_allocations,
                        duration: current_duration,
                    } of iter_queue_duration(data, current_attributes, BEST_IMPLANT_BONUS)) {
                        if (current_duration > best_duration) {
                            break;
                        }
                    }
                    if (current_duration < best_duration) {
                        best_duration = current_duration;
                        best_attributes = current_attributes;
                        result.best_mapping_sp_allocations = current_sp_allocations;
                    }
                }
            }
        }
    }
    result.best!.attributes = best_attributes;
    result.best!.duration_implants = IMPLANT_BONUSES.map(
        (bonus) => calculate_queue_duration(data, best_attributes, bonus).duration
    );
    console ? console.log(_hit, _miss, _hit / (_hit + _miss), _cache.size) : 0;
    return result as unknown as OptimizationResults;
}
