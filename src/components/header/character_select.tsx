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
    hover_position: number | null; // negative means pin to the right
}

export default class CharacterSelect extends React.PureComponent<
    CharacterSelectProps,
    CharacterSelectState
> {
    ref: React.RefObject<HTMLDivElement>;

    constructor(props) {
        super(props);
        this.state = {hover_position: null};
        this.ref = React.createRef();
    }

    on_mouse_enter = () => {
        const domElement = this.ref?.current;
        if (domElement === null) {
            return;
        }
        const dom_rect = domElement.getBoundingClientRect();
        const left_pos = Math.max(0, dom_rect.left);
        const screen_width = document.documentElement.clientWidth;
        const screen_middle = screen_width / 2;
        if (left_pos > screen_middle) {
            this.setState({hover_position: -(screen_width - dom_rect.right)});
        } else {
            this.setState({hover_position: left_pos});
        }
    };

    on_mouse_leave = () => {
        this.setState({hover_position: null});
    };

    render() {
        const p = this.props;
        return (
            <div
                ref={this.ref}
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
                    <img
                        src={character_url(p.id, 64)}
                        width="64"
                        height="64"
                        srcSet={`${character_url(p.id, 64)}, ${character_url(p.id, 128)} 2x, ${character_url(p.id, 256)} 4x`}
                    />
                </div>
                {this.props.valid ? (
                    <SkillProgress current_time={p.current_time} training={p.training} />
                ) : null}
                {this.state.hover_position !== null ? (
                    <CharacterHover hover_position={this.state.hover_position} {...p} />
                ) : null}
            </div>
        );
    }
}
