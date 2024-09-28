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

        let skill_time: React.ReactElement | null = null;
        if (props.sp_min && next_level < 6) {
            const last_level_sp = sp_required(next_level - 1, props.rank);
            const sp_to_train =
                sp_required(next_level, props.rank) -
                Math.max(0, (props.sp || 0) - last_level_sp) -
                last_level_sp;
            const duration = (sp_to_train / props.sp_min) * 60;

            skill_time = <span className="skill_time">{format_duration(duration, false)}</span>;
        }

        return (
            <div
                className={`skill${props.level != null ? "" : " not_injected"}`}
                onClick={this.on_click}
            >
                <span className="skill_lhand_details">
                    <span className={class_name}></span>
                    <h5>{props.name}</h5>
                    {skill_time}
                </span>
                <span className="skill_attribute">{attribute_doms[props.attribute]}</span>
            </div>
        );
    }
}
