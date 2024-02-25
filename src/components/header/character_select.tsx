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
    is_mousedown: boolean;
}

export default class CharacterSelect extends React.PureComponent<
    CharacterSelectProps,
    CharacterSelectState
> {
    constructor(props) {
        super(props);
        this.state = {is_hovered: false, is_mousedown: false};
        this.on_mouse_enter = this.on_mouse_enter.bind(this);
        this.on_mouse_leave = this.on_mouse_leave.bind(this);
        this.on_mouse_down = this.on_mouse_down.bind(this);
        this.on_mouse_up = this.on_mouse_up.bind(this);
        this.on_click = this.on_click.bind(this);
    }

    on_mouse_enter() {
        this.setState({is_hovered: true});
    }

    on_mouse_leave() {
        this.setState({is_hovered: false, is_mousedown: false});
    }

    on_mouse_down() {
        this.setState({is_mousedown: true});
    }
    on_mouse_up() {
        this.setState({is_mousedown: false});
    }

    on_click() {
        const p = this.props;
        p.on_click(p.id, p.name, p.valid);
    }

    render() {
        const p = this.props;
        return (
            <div
                onMouseEnter={this.on_mouse_enter}
                onMouseLeave={this.on_mouse_leave}
                onMouseDown={this.on_mouse_down}
                onMouseUp={this.on_mouse_up}
                onClick={this.on_click}
                className={
                    "character_select" +
                    (p.selected ? " selected" : "") +
                    (p.valid ? "" : " invalid")
                }
            >
                <div className="character_select_container">
                    <img draggable={false} src={character_url(p.id, 64)} width="64" height="64" />
                </div>
                {this.props.valid ? (
                    <SkillProgress current_time={p.current_time} training={p.training} />
                ) : null}
                {this.state.is_hovered && !this.state.is_mousedown ? (
                    <CharacterHover {...p} />
                ) : null}
            </div>
        );
    }
}
