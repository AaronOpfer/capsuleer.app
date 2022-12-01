import * as skill_data_raw from "./skills.json";

export interface StaticSkill {
    readonly id: number,
    readonly category_id: number,
    readonly name: string,
    readonly rank: number,
    readonly attribute: number
}

export interface StaticSkillCategory {
    readonly id: number,
    readonly name: string,
    readonly skills: StaticSkill[]
}

export class StaticSkillData {
    _ids: { [id: string]: StaticSkill|StaticSkillCategory };
    categories: StaticSkillCategory[]
    skills: StaticSkill[]
    constructor(skill_json) {
        this._ids = {};
        const category_to_skills = {};
        for (const skill of skill_json[1]) {
            const staticskill = this._ids[skill[0]] = Object.freeze({
                id: skill[0],
                category_id: skill[1],
                name: skill[2],
                rank: skill[3],
                attribute: skill[4]
            });
            (category_to_skills[skill[1]] = category_to_skills[skill[1]] || []).push(staticskill);
        }

        this.categories = [];
        this.skills = [];

        for (const category of skill_json[0]) {
            const cat = this._ids[category[0]] = Object.freeze({
                id: category[0],
                name: category[1],
                skills: Object.freeze(category_to_skills[category[0]])
            })
            this.skills = this.skills.concat(cat.skills);
            this.categories.push(cat);
        }
        Object.freeze(this._ids);
        Object.freeze(this.skills);
    }

    skill(id: number):StaticSkill {
        return this._ids[id] as StaticSkill;
    }

    category(id: number):StaticSkillCategory {
        return this._ids[id] as StaticSkillCategory;
    }
}

export const skill_data = new StaticSkillData(skill_data_raw);
