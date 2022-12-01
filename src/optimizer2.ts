import {skill_data} from "./static_skill_data";
import {CharacterSkills, CharacterSkillQueueItem} from "./character_skills";
import {sp_required, sp_per_minute, attribute_bitmasks} from "./misc/sp";

type SkillAttributes = [number, number, number, number, number];
type RelevantAttributesMask = [boolean, boolean, boolean, boolean, boolean];

export interface SkillQueueSegmentItem {
    id: number;
    level: number;
    sp_to_finish: number;
}

export interface SkillQueueSegment {
    items: SkillQueueSegmentItem[];
    attributes: SkillAttributes;
    duration: number;
    relevant_attributes: RelevantAttributesMask;
}

export function* iter_queue_duration(
    queue: SkillQueueSegmentItem[],
    attributes: SkillAttributes,
    implant_bonus: number = 0.0
) {
    let duration = 0; // seconds

    const relevant_attributes = new Set<number>();

    for (const {id: skill_id, sp_to_finish} of queue) {
        const attribute = skill_data.skill(skill_id).attribute;
        const sp_per_second = sp_per_minute(attributes, attribute) / 60;
        duration += sp_to_finish / sp_per_second;
        yield duration;
    }
}

export function calculate_queue_duration(
    queue: SkillQueueSegmentItem[],
    attributes: SkillAttributes,
    implant_bonus: number = 0.0
): number {
    let duration = 0;
    for (duration of iter_queue_duration(queue, attributes, implant_bonus));
    return duration;
}

export function get_relevant_attributes(queue: SkillQueueSegmentItem[]): RelevantAttributesMask {
    let mask: number = 0;
    for (const {id} of queue) {
        mask |= attribute_bitmasks[skill_data.skill(id).attribute];
    }
    return [
        (mask & 0b10000) != 0,
        (mask & 0b1000) != 0,
        (mask & 0b100) != 0,
        (mask & 0b10) != 0,
        (mask & 1) != 0,
    ];
}

export function optimize_segment(segment: SkillQueueSegment) {
    let best_duration = segment.duration;
    let best_attributes: SkillAttributes = segment.attributes;

    const [has_int, has_mem, has_per, has_wil, has_cha] = segment.relevant_attributes;

    const max_intelligence = has_int ? 27 : 17;
    for (let intelligence = 17; intelligence <= max_intelligence; intelligence++) {
        const max_memory = has_mem ? Math.min(48 - intelligence, 27) : 17;
        for (let memory = 17; memory <= max_memory; memory++) {
            const max_perception = has_per ? Math.min(65 - intelligence - memory, 27) : 17;
            for (let perception = 17; perception <= max_perception; perception++) {
                const max_willpower = has_wil
                    ? Math.min(82 - intelligence - memory - perception, 27)
                    : 17;
                for (let willpower = 17; willpower <= max_willpower; willpower++) {
                    const all_but_one_sum = perception + memory + intelligence + willpower;
                    if (all_but_one_sum < 72) {
                        continue;
                    }
                    const charisma = 99 - all_but_one_sum;
                    if (!has_cha && charisma > 17) {
                        continue;
                    }
                    if (perception + memory + intelligence + willpower + charisma != 99) {
                        // only accept solutions where we max out the attributes.
                        continue;
                    }
                    const current_attributes: SkillAttributes = [
                        intelligence,
                        memory,
                        perception,
                        willpower,
                        charisma,
                    ];
                    let current_duration = 0;
                    for (current_duration of iter_queue_duration(
                        segment.items,
                        current_attributes,
                        0.0
                    )) {
                        if (current_duration > best_duration) {
                            break;
                        }
                    }
                    if (current_duration < best_duration) {
                        best_duration = current_duration;
                        best_attributes = current_attributes;
                    }
                }
            }
        }
    }
    return {best_duration, best_attributes};
}
