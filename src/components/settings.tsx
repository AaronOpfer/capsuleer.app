"use strict";

import React from "react";
import ReactDOM from "react-dom";
import {MoveUp, MoveDown, PersonAdd, PersonRemove} from "./md";
import Headshot from "./headshot";
import {CharacterNameAndId} from "../server";

enum Direction {
    Up,
    Down,
}

interface SettingsCharacterProps {
    character: CharacterNameAndId;
    on_request_move: (direction: Direction, character_id: number) => void;
    on_request_delete: (character_name: string) => void;
}

class SettingsCharacter extends React.Component<SettingsCharacterProps> {
    _moveup = () => {
        this.props.on_request_move(Direction.Up, this.props.character.id);
    };
    _movedown = () => {
        this.props.on_request_move(Direction.Down, this.props.character.id);
    };
    _delete = () => {
        this.props.on_request_delete(this.props.character.name);
    };
    render() {
        const char = this.props.character;
        return (
            <div className="settings_character">
                <div className="settings_character_movebuttons">
                    <MoveUp onClick={this._moveup} />
                    <MoveDown onClick={this._movedown} />
                </div>
                <Headshot id={char.id} />
                <span className="settings_character_name">{char.name}</span>
                <PersonRemove className="md settings_character_delete" onClick={this._delete} />
            </div>
        );
    }
}

interface SettingsProps {
    characters: CharacterNameAndId[] | null;
    on_change_character_order: (new_order: number[]) => void;
    on_request_delete: (character_name: string) => void;
}

export default class Settings extends React.PureComponent<SettingsProps> {
    move_character = (direction: Direction, character_id: number) => {
        if (this.props.characters === null) return;
        const order = this.props.characters.map((c) => c.id);
        const offset = direction == Direction.Up ? -1 : 1;
        const moving_index = order.indexOf(character_id);
        const new_index = moving_index + offset;
        if (new_index > order.length - 1) return;
        if (new_index < 0) return;
        order.splice(moving_index, 1);
        order.splice(new_index, 0, character_id);
        this.props.on_change_character_order(order);
    };

    render() {
        const characters = this.props.characters;
        if (characters === null) {
            return <div className="settings loading"></div>;
        }
        const display = characters.map((character) => (
            <SettingsCharacter
                key={character.id}
                on_request_delete={this.props.on_request_delete}
                on_request_move={this.move_character}
                character={character}
            />
        ));
        return (
            <div className="settings">
                <div className="settings_interior">
                    <h3>Your Characters</h3>
                    <a
                        href="/auth"
                        className="settings_add_character"
                        title="Add Another Character"
                    >
                        <PersonAdd />
                        <br />
                        Add Character
                    </a>
                    <div>{display}</div>
                </div>
            </div>
        );
    }
}
