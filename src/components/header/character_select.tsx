import React from "react";
import {character_url} from "../../misc/urls";
import {CharacterTrainingProgress} from "../../server";
import {CharacterHover} from "./character_hover";
import {SkillProgress} from "./skill_progress";

export interface CharacterSelectProps {
    id: number;
    name: string;
    selected: boolean;
    on_click: (number, string, boolean) => void;
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
