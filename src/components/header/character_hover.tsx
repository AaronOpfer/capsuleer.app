import React from "react";
import {skill_data} from "../../static_skill_data";
import {format_duration} from "../../misc/formatting";
import {CharacterSelectProps} from "./character_select";

export class CharacterHover extends React.PureComponent<
    CharacterSelectProps & {hover_position: number},
    Record<string, never>
> {
    render() {
        const hover_position = this.props.hover_position;
        const style = hover_position >= 0 ? {left: hover_position} : {right: -hover_position};
        if (!this.props.valid) {
            return (
                <div style={style} className="character_select_hover">
                    <h4>{this.props.name}</h4>
                    <span>Log into this character again</span>
                </div>
            );
        }
        const t = this.props.training;
        if (t === undefined) {
            return (
                <div style={style} className="character_select_hover loading">
                    <h4>{this.props.name}</h4>
                </div>
            );
        }
        if (t.skill_id === undefined) {
            return (
                <div style={style} className="character_select_hover">
                    <h4>{this.props.name}</h4>
                    <span>No skill in training</span>
                </div>
            );
        }
        const end = +t.end_date!;
        const now = +new Date();

        const skill = skill_data.skill(t.skill_id!);

        return (
            <div style={style} className="character_select_hover">
                <h4>{this.props.name}</h4>
                <h4>
                    {skill.name} {t.level!}
                </h4>
                <span>Finishes in {format_duration((end - now) / 1000)}</span>
            </div>
        );
    }
}
