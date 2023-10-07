import React from "react";
import CharacterSelect from "./character_select";
import {
    CharacterTrainingProgress,
    CharacterNameAndId,
    download_character_training_progress,
} from "../../server";

interface HeaderProps {
    characters: CharacterNameAndId[];
    selected: number | null;
    on_character_select: any;
}

interface HeaderState {
    training_data: {[id: number]: CharacterTrainingProgress};
    current_time: Date;
}

export default class Header extends React.PureComponent<HeaderProps, HeaderState> {
    earliest_end_date: Date | undefined;
    timeout: number | undefined;
    hovered: boolean;

    constructor(props) {
        super(props);
        this.state = {training_data: {}, current_time: new Date()};
        for (const character of props.characters) {
            if (!character.valid) {
                this.state.training_data[character.id] = {
                    character_id: character.id,
                    level: undefined,
                    sp: undefined,
                    skill_id: undefined,
                    start_date: undefined,
                    end_date: undefined,
                };
            }
        }
        this.earliest_end_date = undefined;
        this.timeout = undefined;
        this.hovered = false;
    }

    async componentDidMount() {
        await this.update_training_data();
    }

    async update_training_data() {
        let training_data = {...this.state.training_data};
        const now = new Date();
        for (const [char_id, item] of Object.entries(training_data)) {
            if (item !== undefined && item.end_date !== undefined && item.end_date <= now) {
                training_data[char_id] = undefined;
            }
        }

        this.setState({training_data, current_time: now});
        this.earliest_end_date = undefined;
        for await (const progress of download_character_training_progress()) {
            if (
                progress.end_date != undefined &&
                (this.earliest_end_date === undefined || progress.end_date < this.earliest_end_date)
            ) {
                this.earliest_end_date = progress.end_date;
            }
            training_data = {...training_data};
            training_data[progress.character_id] = progress;
            this.setState({training_data, current_time: new Date()});
        }
        this.update_time();
    }

    update_time() {
        if (this.timeout !== undefined) {
            clearTimeout(this.timeout);
        }
        const now = +new Date();
        let delay = this.hovered ? 1000 : 10000;
        if (this.earliest_end_date !== undefined) {
            const earliest = +this.earliest_end_date;
            if (now >= earliest) {
                this.update_training_data();
                return;
            }
            delay = Math.min(earliest - now, delay);
        }
        this.timeout = window.setTimeout(() => {
            this.timeout = undefined;
            this.update_time();
        }, delay);
        this.setState({current_time: new Date()});
    }

    render() {
        return (
            <header
                onMouseEnter={() => {
                    this.hovered = true;
                    this.update_time();
                }}
                onMouseLeave={() => {
                    this.hovered = false;
                }}
            >
                <div>
                    {(this.props.characters || []).map((c) => (
                        <CharacterSelect
                            id={c.id}
                            key={c.id}
                            valid={c.valid}
                            name={c.name}
                            current_time={this.state.current_time}
                            selected={c.id == this.props.selected}
                            on_click={this.props.on_character_select}
                            training={this.state.training_data[c.id]}
                        />
                    ))}
                    <div className="spacer" />
                    <a className="header_add_character" title="Add another character" href="/auth">
                        +
                    </a>
                </div>
            </header>
        );
    }
}
