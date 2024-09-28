import React from "react";
import {attribute_types, sp_required} from "../misc/sp";
import {format_duration} from "../misc/formatting";

const single_attribute_doms = {
    intelligence: (
        <span key="i" className="intelligence">
            I
        </span>
    ),
    memory: (
        <span key="m" className="memory">
            M
        </span>
    ),
    perception: (
        <span key="p" className="perception">
            P
        </span>
    ),
    willpower: (
        <span key="w" className="willpower">
            W
        </span>
    ),
    charisma: (
        <span key="c" className="charisma">
            C
        </span>
    ),
};

const attribute_doms: {[attribute: number]: React.ReactNode[]} = {};
attribute_types.forEach((value, key) => {
    attribute_doms[key] = value.split("/").map((v) => single_attribute_doms[v]);
});

interface SkillProps {
    on_skill_click: (number) => void;
    sp_min: number | null;
    training_level: number;
    id: number;
    category_id: number;
    name: string;
    rank: number;
    attribute: number;
    level: number | undefined;
    sp: number | undefined;
    desired_level: number | undefined;
}

export default class Skill extends React.PureComponent<SkillProps, Record<string, never>> {
    on_click = () => {
        this.props.on_skill_click(this.props.id);
    };

    render() {
        const props = this.props;
        let class_name = "s";
        let next_level = 1;
        if (props.level != null) {
            const training_level = props.training_level ? props.training_level - props.level : 0;
            class_name = `s s${props.level}_${training_level}`;
            next_level = Math.max(props.level, props.training_level) + 1;
        }

        const desired_level = props.desired_level ? props.desired_level : next_level;

        let skill_time: React.ReactElement | null = null;
        if (props.sp_min && desired_level < 6) {
            const sp_needed_to_reach_desired =
                sp_required(desired_level, props.rank) - (props.sp || 0);
            if (sp_needed_to_reach_desired > 0) {
                const duration = (sp_needed_to_reach_desired / props.sp_min) * 60;
                skill_time = <span className="skill_time">{format_duration(duration, false)}</span>;
            }
        }

        return (
            <div
                className={`skill${props.level != null ? "" : " not_injected"}`}
                onClick={this.on_click}
            >
                <span className="skill_lhand_details">
                    <span className={class_name}></span>
                    <h5>
                        {props.name}{" "}
                        {props.desired_level
                            ? [" I", " II", " III", " IV", " V"][props.desired_level - 1]
                            : null}
                    </h5>
                    {skill_time}
                </span>
                <span className="skill_attribute">{attribute_doms[props.attribute]}</span>
            </div>
        );
    }
}
