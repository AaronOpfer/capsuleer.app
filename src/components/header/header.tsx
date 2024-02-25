import React, {Fragment, DragEvent} from "react";
import CharacterSelect from "./character_select";
import {setTimeoutWithVisibility, TimeoutHandle} from "../../misc/visibilitytimeout";
import {
    CharacterTrainingProgress,
    CharacterNameAndId,
    download_character_training_progress,
} from "../../server";

interface HeaderProps {
    characters: CharacterNameAndId[];
    selected: number | null;
    on_character_select: (id: number, name: string, valid: boolean) => void;
    on_change_character_order: (new_order: number[]) => void;
}

interface CharacterDragging {
    moving_character: number;
    dragging_over: number | null;
}

interface HeaderState {
    training_data: {[id: number]: CharacterTrainingProgress};
    current_time: Date;
    dragging: CharacterDragging | null;
}

export default class Header extends React.PureComponent<HeaderProps, HeaderState> {
    earliest_end_date: Date | undefined;
    timeout: TimeoutHandle | undefined;
    hovered: boolean;

    constructor(props) {
        super(props);
        this.state = {training_data: {}, current_time: new Date(), dragging: null};
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
        this.on_drop = this.on_drop.bind(this);
        this.on_drag_start = this.on_drag_start.bind(this);
        this.on_drag_enter = this.on_drag_enter.bind(this);
        this.on_drag_leave = this.on_drag_leave.bind(this);
        this.on_drag_end = this.on_drag_end.bind(this);
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
        this.earliest_end_date = new Date();
        this.earliest_end_date.setMinutes(this.earliest_end_date.getMinutes() + 10);
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
            this.timeout.cancel();
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
        this.timeout = setTimeoutWithVisibility(() => {
            this.timeout = undefined;
            this.update_time();
        }, delay);
        this.setState({current_time: new Date()});
    }

    on_drag_enter(event: DragEvent<HTMLDivElement>) {
        const character_index = +event.currentTarget.dataset.index!;
        const dragging = {...this.state.dragging!, dragging_over: character_index};
        this.setState({dragging});
    }

    on_drag_leave(event: DragEvent<HTMLDivElement>) {
        const character_index = +event.currentTarget.dataset.index!;
        if (this.state.dragging?.dragging_over === character_index) {
            const dragging = {...this.state.dragging!, dragging_over: null};
            this.setState({dragging});
        }
    }

    on_drag_end() {
        if (this.state.dragging !== null) {
            this.setState({dragging: null});
        }
    }

    on_drag_start(event: DragEvent<HTMLDivElement>) {
        const character_id = +event.currentTarget.dataset.character_id!;
        this.setState({dragging: {moving_character: character_id, dragging_over: null}});
    }

    on_drop(event: DragEvent<HTMLDivElement>) {
        const new_index = +event.currentTarget.dataset.index!;
        const order = this.props.characters.map((c) => c.id);
        const moving_cid = this.state.dragging!.moving_character;
        const moving_index = order.indexOf(moving_cid);
        order.splice(moving_index, 1);
        order.splice(new_index, 0, moving_cid);
        this.props.on_change_character_order(order);
        this.setState({dragging: null});
    }

    on_drag_over(event: DragEvent) {
        event.dataTransfer.dropEffect = "move";
        event.preventDefault();
    }

    on_mouse_enter = () => {
        this.hovered = true;
        this.update_time();
    };

    on_mouse_leave = () => {
        this.hovered = false;
    };

    render() {
        let characters = this.props.characters || [];
        const dragging = this.state.dragging;
        let dragging_index = -1;
        let dragging_over: number | null = null;
        if (dragging !== null) {
            dragging_index = characters.findIndex((c) => c.id == dragging.moving_character);
            dragging_over = dragging.dragging_over;
            if (dragging_over !== null) {
                const order = this.props.characters.map((c) => c.id);
                order.splice(dragging_index, 1);
                order.splice(dragging_over, 0, dragging.moving_character);
                characters = order.map((cid) => characters.find((c) => c.id == cid)!);
            }
        }

        return (
            <header
                className={dragging ? "dragging" : undefined}
                onMouseEnter={this.on_mouse_enter}
                onMouseLeave={this.on_mouse_leave}
            >
                {characters.map((c, idx) => (
                    <Fragment key={idx}>
                        <div
                            data-index={idx}
                            className={
                                "header_draganddrop_dropzone" +
                                (idx === dragging?.dragging_over ? " target" : "")
                            }
                            style={dragging_index != idx ? undefined : {display: "none"}}
                            onDragOver={this.on_drag_over}
                            onDragEnter={this.on_drag_enter}
                            onDragLeave={this.on_drag_leave}
                            onDrop={this.on_drop}
                        />
                        <div
                            data-character_id={c.id}
                            draggable={
                                characters.length > 2 || (characters.length == 1 && idx == 0)
                                    ? true
                                    : false
                            }
                            className={
                                "header_draganddrop_wrapper" +
                                (c.id === dragging?.moving_character ? " dragging" : "")
                            }
                            onDragStart={this.on_drag_start}
                            onDragEnd={this.on_drag_end}
                        >
                            <CharacterSelect
                                id={c.id}
                                valid={c.valid}
                                name={c.name}
                                current_time={this.state.current_time}
                                selected={c.id == this.props.selected}
                                on_click={this.props.on_character_select}
                                training={this.state.training_data[c.id]}
                            />
                        </div>
                    </Fragment>
                ))}
                <div className="spacer" />
                <a className="header_add_character" title="Add another character" href="/auth">
                    +
                </a>
            </header>
        );
    }
}
