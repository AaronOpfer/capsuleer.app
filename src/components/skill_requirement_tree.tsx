import {Component, JSX} from "preact/compat";
import {StaticSkill, skill_data} from "../static_skill_data";

interface SkillRequirementTreeProps {
    skill: StaticSkill;
    skillComponentRenderer: (skill: StaticSkill, desiredLevel: number) => JSX.Element;
}

export default class SkillRequirementTree extends Component<
    SkillRequirementTreeProps,
    Record<string, never>
> {
    render() {
        const props = this.props;
        return (
            <SkillRequirementTreeNode
                skillComponentRenderer={props.skillComponentRenderer}
                skill={props.skill}
                level={1}
            />
        );
    }
}

interface SkillRequirementTreeNodeProps {
    skill: StaticSkill;
    skillComponentRenderer: (skill: StaticSkill, desiredLevel: number) => JSX.Element;
    level: number;
}

class SkillRequirementTreeNode extends Component<
    SkillRequirementTreeNodeProps,
    Record<string, never>
> {
    render() {
        const {skill, level, skillComponentRenderer} = this.props;
        const children = skill.prerequisites.map((prereq) => {
            return (
                <SkillRequirementTreeNode
                    key={prereq.skillId}
                    skill={skill_data.skill(prereq.skillId)}
                    level={prereq.skillLevel}
                    skillComponentRenderer={skillComponentRenderer}
                />
            );
        });

        return (
            <div className="skill_requirement_tree_node">
                {this.props.skillComponentRenderer(skill, level)}
                <div>{children}</div>
            </div>
        );
    }
}
