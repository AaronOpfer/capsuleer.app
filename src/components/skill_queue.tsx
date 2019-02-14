import React from "react";
import {skill_data} from "../static_skill_data";
import {format_duration} from "../misc/formatting";
import CharacterSkills from "../character_skills";

const level = ["I", "II", "III", "IV", "V"];

interface DurationProps {
    target_date: Date | null;
    duration: number;
    className?: string;
}

class Duration extends React.PureComponent<DurationProps, {}> {
    render() {
        const {target_date, duration, className} = this.props;
        return (
            <span
                className={className}
                title={target_date ? target_date.toLocaleString() : undefined}
            >
                {format_duration(duration)}
            </span>
        );
    }
}

interface SkillQueueProps {
    data: CharacterSkills | null;
}

export default class SkillQueue extends React.Component<SkillQueueProps, {}> {
    render() {
        const data = this.props.data;
        if (data == null) {
            return (
                <div className="skill_queue_loading">
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

        let offset = 0;
        const skill_doms = data.skill_queue.map((queue_item) => {
            const skill = skill_data.skill(queue_item.id);
            const trained_level = data.skill_level(queue_item.id);
            const duration = queue_item.duration;
            const duration_as_percentage = (100 * duration) / queue_total_duration;
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
                    />
                    <div
                        className="skill_queue_duration_bar"
                        style={{
                            left: `${current_offset}%`,
                            width: `${duration_as_percentage}%`,
                        }}
                    />
                </React.Fragment>
            );
        });
        const text = data.skill_queue_paused
            ? "Skill queue is currently paused and will take "
            : "Skill queue ends in ";
        return (
            <div className="skill_queue">
                <div className="skill_queue_header">
                    <span>{text}</span>
                    <Duration target_date={queue_ends} duration={queue_total_duration} />
                </div>
                <div className="skill_queue_contents cat_dbl">{skill_doms}</div>
            </div>
        );
    }
}

interface SkillQueueItemProps {
    category_id: number;
    name: string;
    level: number;
    trained_level: number;
    duration: number;
    end_date: Date | null;
}

class SkillQueueItem extends React.PureComponent<SkillQueueItemProps, {}> {
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
                />
                <span
                    className={`s s${props.trained_level}_${props.level - props.trained_level}`}
                />
            </div>
        );
    }
}
