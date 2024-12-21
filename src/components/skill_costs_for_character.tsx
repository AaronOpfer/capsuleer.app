import React from "react";
import CharacterSkills from "../character_skills";
import {StaticSkill, skill_data} from "../static_skill_data";
import {attribute_types, sp_required} from "../misc/sp";
import {format_duration, format_with_decimals} from "../misc/formatting";

interface SkillCostsForCharacterProps {
    skill: StaticSkill;
    char_skills: CharacterSkills | null;
}

export default class SkillCostsForCharacter extends React.Component<
    SkillCostsForCharacterProps,
    Record<string, never>
> {
    render() {
        if (this.props.char_skills === null) {
            return null;
        }
        const levelRequirements = new Map<number, number>();
        levelRequirements.set(this.props.skill.id, 1);
        const findLevelRequirements = (skillId: number) => {
            skill_data.skill(skillId).prerequisites.forEach(({skillId, skillLevel}) => {
                levelRequirements.set(
                    skillId,
                    Math.max(levelRequirements.get(skillId) || 0, skillLevel),
                );
                findLevelRequirements(skillId);
            });
        };
        findLevelRequirements(this.props.skill.id);
        let requiredTimeSeconds = 0;
        let requiredSP = 0;
        for (const [skillId, requiredLevel] of levelRequirements.entries()) {
            const skill = skill_data.skill(skillId);
            const spRequiredForLevel = sp_required(requiredLevel, skill.rank);
            const charSkill = this.props.char_skills.skills[skillId];
            const remainingSpRequiredForLevel =
                charSkill === undefined
                    ? spRequiredForLevel
                    : Math.max(0, spRequiredForLevel - charSkill.sp);
            requiredSP += remainingSpRequiredForLevel;
            requiredTimeSeconds +=
                (remainingSpRequiredForLevel /
                    this.props.char_skills.sp_per_minute(skill.attribute)) *
                60;
        }
        return (
            <table>
                <tbody>
                    <tr>
                        <th>SP cost</th>
                        <td>{format_with_decimals(requiredSP, 0)}</td>
                    </tr>
                    <tr>
                        <th>Time cost</th>
                        <td>{format_duration(requiredTimeSeconds)}</td>
                    </tr>
                </tbody>
            </table>
        );
    }
}
