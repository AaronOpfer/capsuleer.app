import React from "react";
import {CharacterTrainingProgress} from "../../server";
import {skill_data} from "../../static_skill_data";
import {format_duration} from "../../misc/formatting";
import {CharacterSelectProps} from "./character_select";

export class CharacterHover extends React.PureComponent<CharacterSelectProps, {}> {
    render() {
        if (!this.props.valid) {
            return (
                <div className="character_select_hover">
                    <h4>{this.props.name}</h4>
                    <span>Log into this character again</span>
                </div>
            );
        }
        const t = this.props.training;
        if (t === undefined) {
            return (
                <div className="character_select_hover loading">
                    <h4>{this.props.name}</h4>
                </div>
            );
        }
        if (t.skill_id === undefined) {
            return (
                <div className="character_select_hover">
                    <h4>{this.props.name}</h4>
                    <span>No skill in training</span>
                </div>
            );
        }
        const end = +t.end_date!;
        const now = +new Date();

        const skill = skill_data.skill(t.skill_id!);
        return (
            <div className="character_select_hover">
                <h4>{this.props.name}</h4>
                <h4>
                    {skill.name} {t.level!}
                </h4>
                <span>Finishes in {format_duration((end - now) / 1000)}</span>
            </div>
        );
    }
}

