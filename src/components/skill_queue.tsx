import React from "react";
import {skill_data} from "../static_skill_data";
import {format_duration} from "../misc/formatting";
import CharacterSkills from "../character_skills";
import {sp_required, calculate_number_of_injectors} from "../misc/sp";
import {format_with_decimals} from "../misc/formatting";

const level = ["I", "II", "III", "IV", "V"];

interface DurationProps {
    target_date: Date | null;
    duration: number;
    className?: string;
    show_seconds?: boolean;
}

class Duration extends React.PureComponent<DurationProps, Record<string, never>> {
    render() {
        const {target_date, duration, className} = this.props;
        return (
            <span
                className={className}
                title={target_date ? target_date.toLocaleString() : undefined}
            >
                {format_duration(duration, this.props.show_seconds)}
            </span>
        );
    }
}

interface SkillQueueProps {
    data: CharacterSkills | null;
}

export default class SkillQueue extends React.Component<SkillQueueProps, Record<string, never>> {
    render() {
        const data = this.props.data;
        if (data == null) {
            return (
                <div className="skill_queue skill_queue_loading">
                    <img className="loading_indicator" src="s/loading.svg" />
                </div>
            );
        }
        if (data.skill_queue.length == 0) {
            return <div className="skill_queue_empty">Skill Queue is Empty</div>;
        }
        const now = +new Date();
        const queue_ends = data.skill_queue[data.skill_queue.length - 1].end_date;
        let queue_total_duration = 0;
        if (queue_ends == undefined) {
            for (let i = 0; i < data.skill_queue.length; i++) {
                queue_total_duration += data.skill_queue[i].duration;
            }
        } else {
            const queue_begins = Math.max(now, +data.skill_queue[0].start_date!);
            queue_total_duration = (+queue_ends - queue_begins) / 1000;
        }

        // used to calculate how much of a "white" unallocated SP bar we will render.
        let sp_left_to_allocate = data.unallocated_sp;

        let offset = 0;
        let sp_costs = 0;
        const skill_doms = data.skill_queue.map((queue_item, queue_item_index) => {
            const skill = skill_data.skill(queue_item.id);
            const previous_level_sp = sp_required(queue_item.level - 1, skill.rank);
            const char_skill_sp = data.skills[queue_item.id].sp;
            const sp_required_to_train =
                sp_required(queue_item.level, skill.rank) -
                Math.max(previous_level_sp, char_skill_sp);
            sp_costs += sp_required_to_train;
            const trained_level = data.skill_level(queue_item.id);

            const injectable_sp = Math.min(sp_left_to_allocate, sp_required_to_train);
            sp_left_to_allocate -= injectable_sp;

            const injectable_ratio = injectable_sp / sp_required_to_train;

            const duration = queue_item.duration;
            const duration_as_percentage = (100 * duration) / queue_total_duration;
            const injectable_duration_as_percentage = duration_as_percentage * injectable_ratio;
            const current_offset = offset;
            offset += duration_as_percentage;

            return (
                <React.Fragment key={`${queue_item.id}_${queue_item.level}`}>
                    <SkillQueueItem
                        {...skill}
                        level={queue_item.level}
                        trained_level={trained_level}
                        end_date={queue_item.end_date}
                        duration={duration}
                        index={queue_item_index}
                    />
                    <SkillQueueDurationBar
                        left={current_offset}
                        injectable_width={injectable_duration_as_percentage}
                        overall_width={duration_as_percentage}
                    />
                </React.Fragment>
            );
        });
        const new_sp = Math.round(data.total_sp + sp_costs);
        sp_costs = Math.round(sp_costs);

        let injectors = calculate_number_of_injectors(data.total_sp, data.unallocated_sp, sp_costs);
        if (injectors > 0 && injectors < 0.1) {
            injectors = 0.1; // otherwise misleading
        }

        const text = data.skill_queue_paused
            ? "Skill queue is currently paused and will take:"
            : "Skill queue ends in:";
        return (
            <div className="skill_queue">
                <div className="skill_queue_header">
                    <span className="skill_queue_duration">
                        {text}
                        <br />
                        <Duration target_date={queue_ends} duration={queue_total_duration} />
                    </span>
                    <span
                        className="skill_queue_injectors"
                        title={
                            data.unallocated_sp
                                ? "Number of injectors required to instantly complete this skill queue, taking into account unallocated SP"
                                : "Number of injectors required to instantly complete this skill queue"
                        }
                    >
                        <img
                            width={32}
                            height={32}
                            src="https://images.evetech.net/types/40520/icon?size=64"
                        />
                        x {format_with_decimals(injectors, 1)}
                    </span>
                    <div className="skill_queue_sp_info">
                        <span title="SP required to finish this skill queue">
                            Cost: {format_with_decimals(sp_costs, 0)} SP
                        </span>
                        <br />
                        <span title="How much SP this character will have when the skill queue is complete">
                            {format_with_decimals(new_sp, 0)} SP
                        </span>
                    </div>
                </div>
                <div className="skill_queue_contents cat_dbl">{skill_doms}</div>
            </div>
        );
    }
}

interface SkillQueueDurationBarProps {
    left: number;
    injectable_width: number;
    overall_width: number;
}

class SkillQueueDurationBar extends React.PureComponent<
    SkillQueueDurationBarProps,
    Record<string, never>
> {
    render() {
        const props = this.props;

        if (props.injectable_width == 0) {
            return (
                <div
                    className="skill_queue_duration_bar"
                    style={{
                        left: `${props.left}%`,
                        width: `${props.overall_width}%`,
                    }}
                />
            );
        } else if (props.injectable_width == props.overall_width) {
            return (
                <div
                    className="skill_queue_duration_bar_injectable"
                    style={{
                        left: `${props.left}%`,
                        width: `${props.overall_width}%`,
                    }}
                />
            );
        } else {
            return (
                <React.Fragment>
                    <div
                        className="skill_queue_duration_bar_injectable"
                        style={{
                            left: `${props.left}%`,
                            width: `${props.injectable_width}%`,
                        }}
                    />
                    <div
                        className="skill_queue_duration_bar"
                        style={{
                            left: `${props.injectable_width + props.left}%`,
                            width: `${props.overall_width - props.injectable_width}%`,
                        }}
                    />
                </React.Fragment>
            );
        }
    }
}

interface SkillQueueItemProps {
    category_id: number;
    name: string;
    level: number;
    trained_level: number;
    duration: number;
    end_date: Date | null;
    index: number;
}

class SkillQueueItem extends React.PureComponent<SkillQueueItemProps, Record<string, never>> {
    render() {
        const props = this.props;
        return (
            <div className="skill_queue_item">
                <span className="skill_queue_lhand">
                    <span data-cid={props.category_id}>{props.name} </span>
                    <span className="skill_queue_level">{level[props.level - 1]}</span>
                </span>
                <Duration
                    className="skill_time"
                    target_date={props.end_date}
                    duration={props.duration}
                    show_seconds={props.index == 0}
                />
                <span
                    className={`s s${props.trained_level}_${props.level - props.trained_level}`}
                />
            </div>
        );
    }
}
