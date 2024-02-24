import React from "react";
import {character_url} from "../../misc/urls";
import {CharacterTrainingProgress} from "../../server";
import {skill_data} from "../../static_skill_data";
import {format_duration} from "../../misc/formatting";
import {SkillProgress} from "./skill_progress";

interface CharacterSelectProps {
    id: number;
    name: string;
    selected: boolean;
    on_click: any;
    valid: boolean;
    training: CharacterTrainingProgress | undefined;
    current_time: Date;
}

interface CharacterSelectState {
    is_hovered: boolean;
}

export default class CharacterSelect extends React.PureComponent<
    CharacterSelectProps,
    CharacterSelectState
> {
    constructor(props) {
        super(props);
        this.state = {is_hovered: false};
        this.on_mouse_enter = this.on_mouse_enter.bind(this);
        this.on_mouse_leave = this.on_mouse_leave.bind(this);
    }

    on_mouse_enter() {
        this.setState({is_hovered: true});
    }

    on_mouse_leave() {
        this.setState({is_hovered: false});
    }

    render() {
        const p = this.props;
        return (
            <div
                onMouseEnter={this.on_mouse_enter}
                onMouseLeave={this.on_mouse_leave}
                onClick={() => p.on_click(p.id, p.name, p.valid)}
                className={
                    "character_select" +
                    (p.selected ? " selected" : "") +
                    (p.valid ? "" : " invalid")
                }
            >
                <div className="character_select_container">
                    <img src={character_url(p.id, 64)} width="64" height="64" />
                </div>
                {this.props.valid ? (
                    <SkillProgress current_time={p.current_time} training={p.training} />
                ) : null}
                {this.state.is_hovered ? <CharacterHover {...p} /> : null}
            </div>
        );
    }
}

class CharacterHover extends React.PureComponent<CharacterSelectProps, {}> {
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
