import {skill_data} from "./static_skill_data";
import {sp_required, attribute_types, attribute_names} from "./misc/sp";

function color_band(color1, color2, weight): string {
    const p = 1 - weight;
    const w = p * 2 - 1;
    const w1 = (w / 1 + 1) / 2;
    const w2 = 1 - w1;
    const rgb = [
        Math.round(color1[0] * w1 + color2[0] * w2),
        Math.round(color1[1] * w1 + color2[1] * w2),
        Math.round(color1[2] * w1 + color2[2] * w2),
    ];
    return `rgb(${rgb.join(",")})`;
}

interface CharacterSkillQueueItem {
    id: number;
    level: number;
    start_date: Date | null;
    end_date: Date | null;
    duration: number;
}

interface CharacterSkillItem {
    id: number;
    level: number;
    trained_level: number;
    sp: number;
}

enum BiologyImplant {
    no_implant = 0,
    BY805 = 1,
    BY810 = 2,
}

export default class CharacterSkills {
    total_sp: number;
    unallocated_sp: number;
    wallet_balance: number;
    intelligence: number;
    memory: number;
    perception: number;
    willpower: number;
    charisma: number;
    skill_queue: CharacterSkillQueueItem[];
    skills: {[id: number]: CharacterSkillItem};
    skill_queue_paused: boolean;
    accelerator_amount: number;
    implants: number[];
    biology_implant_bonus: number;

    constructor(skill_json) {
        this.total_sp = skill_json[0];
        this.skills = {};
        skill_json[2].forEach((i) => {
            this.skills[i[0]] = Object.freeze({
                id: i[0],
                level: i[1],
                trained_level: i[2],
                sp: i[3],
            });
        });
        const current_attributes = skill_json[3];
        const implant_bonuses = skill_json[7];
        const unboosted_attributes = current_attributes.map((v, i) => v - implant_bonuses[i]);
        this.accelerator_amount = (unboosted_attributes.reduce((a, b) => a + b, 0) - 99) / 5;
        [
            this.intelligence,
            this.memory,
            this.perception,
            this.willpower,
            this.charisma,
        ] = current_attributes.map((x) => x - this.accelerator_amount);
        this.wallet_balance = skill_json[4];
        this.unallocated_sp = skill_json[8] || 0;
        this.biology_implant_bonus = {0: 1, 1: 1.05, 2: 1.1}[skill_json[9]];

        if (!skill_json[1].length) {
            // skill queue is empty.
            this.skill_queue = [];
            this.skill_queue_paused = false;
        } else if (skill_json[1][0].length == 2) {
            this.skill_queue_paused = true;
            // skill queue is paused.
            this.skill_queue = skill_json[1].map((i) => ({
                id: i[0],
                level: i[1],
                duration: this.skill_training_duration(i[0], i[1]),
            }));
        } else {
            this.skill_queue_paused = false;
            // skill queue is not paused
            this.skill_queue = skill_json[1].map((i) => ({
                id: i[0],
                level: i[1],
                duration: i[3] - i[2],
                start_date: new Date(i[2] * 1000),
                end_date: new Date(i[3] * 1000),
            }));
        }
        this.update();
    }

    skill_training_duration(skill_id: number, level: number) {
        const static_skill_data = skill_data.skill(skill_id);
        const sp_min = this.sp_per_minute(static_skill_data.attribute);
        const skill_sp_required = sp_required(level, static_skill_data.rank);
        const sp_already_possessed = this.skills[skill_id].sp;

        return ((skill_sp_required - sp_already_possessed) * 60) / sp_min;
    }

    update() {
        // Extrapolate current character skill information based on
        // skill queue contents.
        if (this.skill_queue_paused === true) {
            return;
        }
        let extra_sp = 0;
        const now = new Date();
        // Level up skills that have completed...
        while (this.skill_queue.length && this.skill_queue[0].end_date! < now) {
            const completed_skill = this.skill_queue.shift() as CharacterSkillQueueItem;
            const old_sp = this.skills[completed_skill.id].sp;
            this.skills[completed_skill.id] = Object.freeze({
                id: completed_skill.id,
                level: completed_skill.level,
                trained_level: completed_skill.level, // FIXME?
                sp: sp_required(completed_skill.level, skill_data.skill(completed_skill.id).rank),
            });
            extra_sp += this.skills[completed_skill.id].sp - old_sp;
        }
        // ... and add SP from current skill training in-progress.
        const skill_in_progress = this.skill_queue[0];
        if (skill_in_progress) {
            const sip_rank = skill_data.skill(skill_in_progress.id).rank;
            const sp_rate =
                (sp_required(skill_in_progress.level, sip_rank) -
                    this.skills[skill_in_progress.id].sp) /
                (+skill_in_progress.end_date! - +skill_in_progress.start_date!);
            const time_elapsed = +now - +skill_in_progress.start_date!;
            const sp_gained = sp_rate * time_elapsed;
            skill_in_progress.duration -= time_elapsed / 1000;

            this.skills[skill_in_progress.id] = Object.freeze({
                id: skill_in_progress.id,
                level: skill_in_progress.level - 1,
                trained_level: skill_in_progress.level - 1, // FIXME?
                sp: this.skills[skill_in_progress.id].sp + sp_gained,
            });
            skill_in_progress.start_date = now;
            this.total_sp += extra_sp + sp_gained;
        } else {
            this.total_sp += extra_sp;
        }
    }

    skill_level(skill_id: number): number {
        const skill_data = this.skills[skill_id];
        return skill_data ? skill_data.level : 0;
    }

    sp_per_minute(attr_type: number): number {
        // FIXME should be an enum
        const [primary, secondary] = attribute_types[attr_type].split("/");
        return this[primary] + this[secondary] / 2;
        // FIXME Alpha clone check
    }

    create_styles() {
        const lowest_possible = 17;
        const highest_possible = 32;
        const highest_accel_possible = 32 + 12;
        return attribute_names
            .map((attr) => {
                const value = this[attr];
                let color;
                if (value <= highest_possible) {
                    color = color_band(
                        [77, 77, 77],
                        [77, 255, 77],
                        (value - lowest_possible) / (highest_possible - lowest_possible)
                    );
                } else {
                    color = color_band(
                        [33, 200, 33],
                        [66, 66, 200],
                        (value - highest_possible) / (highest_accel_possible - highest_possible)
                    );
                }
                return `.${attr} { background-color: ${color}; }`;
            })
            .join("\n");
    }
}
