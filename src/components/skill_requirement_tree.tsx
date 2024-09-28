import React from "react";
import CharacterSkills from "../character_skills";
import {StaticSkill, skill_data} from "../static_skill_data";
import {attribute_types, sp_required} from "../misc/sp";
import {format_duration, format_with_decimals} from "../misc/formatting";


interface SkillRequirementTreeProps {
    skill: StaticSkill,
}

export default class SkillRequirementTree extends React.PureComponent<SkillRequirementTreeProps, Record<string, never>> {
    render () {
        const props = this.props;
        return (
            <SkillRequirementTreeNode skill={props.skill} level={1} />
        );
    }
}


interface SkillRequirementTreeNodeProps {
    skill: StaticSkill,
    level: number,
}

const levelText = ["I", "II", "III", "IV", "V"];

class SkillRequirementTreeNode extends React.PureComponent<SkillRequirementTreeNodeProps, Record<string, never>> {
    render () {
        const {skill, level} = this.props;
        const children = skill.prerequisites.map(prereq => {
            return (
                <SkillRequirementTreeNode key={prereq.skillId} skill={skill_data.skill(prereq.skillId)} level={prereq.skillLevel} />
            );
        });

        return (
            <div className="skill_requirement_tree_node">
                <div>{skill.name} {levelText[level-1]}</div>
                <div>{children}</div>
            </div>
        )
    }
}
