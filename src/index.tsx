"use strict";

import React from "react";
import ReactDOM from "react-dom";
import {character_url} from "./misc/urls";
import {setTimeoutWithVisibility, TimeoutHandle} from "./misc/visibilitytimeout";
import {CharacterSkills} from "./character_skills";
import {
    NeedsLoginError,
    CharacterNeedsUpdated,
    download_characters,
    download_character_skills,
    delete_character,
    CharacterNameAndId,
} from "./server";

import LoginForm from "./components/login_form";
import CharacterExpired from "./components/character_expired";
import ISKForSPPanel from "./components/isk_for_sp";
import SkillQueue from "./components/skill_queue";
import Optimizer from "./components/optimizer";
import Header from "./components/header/header";
import SkillBrowser from "./components/skill_browser";
import CharSummary from "./components/char_summary";
import Wallet from "./components/wallet";

interface BodyProps {
    character_name: string;
    character_id: number;
    invalidate_character: (number) => void;
}

enum CurrentView {
    none = 0,
    skillQueue,
    skillBrowser,
    wallet,
    optimizer,
}

interface BodyState {
    char_skills: CharacterSkills | null;
    view: CurrentView;
    split_view: boolean;
}

class Body extends React.Component<BodyProps, BodyState> {
    update_interval: ReturnType<typeof setInterval> | null;
    refresh_timeout: TimeoutHandle | null;

    constructor(props) {
        super(props);
        const split_view = window.document.body.clientWidth >= 1200;
        this.state = {
            char_skills: null,
            view: split_view ? CurrentView.skillBrowser : CurrentView.skillQueue,
            split_view: split_view,
        };
        this.update_interval = null;
        this.refresh_timeout = null;
        this.on_resize = this.on_resize.bind(this);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.character_id != this.props.character_id) {
            this.setState({char_skills: null});
            this.load_character_data();
        }
    }

    set_view(view: CurrentView) {
        this.setState({view});
    }

    async componentDidMount() {
        window.addEventListener("resize", this.on_resize, false);
        await this.load_character_data();
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.on_resize);
        if (this.update_interval) {
            clearInterval(this.update_interval);
        }
        if (this.refresh_timeout) {
            this.refresh_timeout.cancel();
        }
    }

    on_resize() {
        const split_view = window.document.body.clientWidth >= 1200;
        if (split_view != this.state.split_view) {
            if (split_view) {
                if (this.state.view == CurrentView.skillQueue) {
                    this.setState({split_view: split_view, view: CurrentView.skillBrowser});
                    return;
                }
            } else {
                this.setState({split_view: split_view, view: CurrentView.skillQueue});
                return;
            }
            this.setState({split_view: split_view});
        }
    }

    async load_character_data() {
        if (this.update_interval) {
            clearInterval(this.update_interval);
        }
        if (this.refresh_timeout) {
            this.refresh_timeout.cancel();
        }

        const character_id = this.props.character_id;

        try {
            const char_skills = await download_character_skills(character_id);
            if (this.props.character_id !== character_id) {
                return;
            }
            this.setState({char_skills});
            if (!char_skills.skill_queue_paused) {
                this.update_interval = setInterval(() => {
                    char_skills.update();
                    this.forceUpdate();
                }, 1000);
                this.refresh_timeout = setTimeoutWithVisibility(() => {
                    this.load_character_data();
                }, 1000 * 5 * 60);
            }
        } catch (err) {
            if (err instanceof CharacterNeedsUpdated) {
                this.props.invalidate_character(character_id);
                return;
            }
            if (err instanceof NeedsLoginError) {
                window.show_login();
                return;
            }
            throw err;
        }
    }

    render() {
        const char_skills = this.state.char_skills;

        document.title = `${this.props.character_name} - capsuleer.app`;

        let view;

        switch (this.state.view) {
            case CurrentView.skillQueue:
                view = <SkillQueue key="view" data={char_skills} />;
                break;
            case CurrentView.none:
                break;
            case CurrentView.wallet:
                view = <Wallet key="view" character_id={this.props.character_id} />;
                break;
            case CurrentView.skillBrowser:
                view = <SkillBrowser key="view" data={char_skills} />;
                break;
            case CurrentView.optimizer:
                view = <Optimizer key="view" data={char_skills} />;
                break;
        }

        const tabData = [
            {view: CurrentView.skillQueue, label: "Skill Queue"},
            {view: CurrentView.skillBrowser, label: "Skills"},
            {view: CurrentView.wallet, label: "Wallet"},
            {view: CurrentView.optimizer, label: "One-shot Optimizer"},
        ];
        if (this.state.split_view) {
            tabData.shift();
        }

        const tabs = tabData.map((tab) => (
            <div
                key={tab.label}
                className={this.state.view == tab.view ? "active" : undefined}
                onClick={() => this.set_view(tab.view)}
            >
                {tab.label}
            </div>
        ));

        return (
            <>
                <div className={char_skills ? "top" : "top loading"}>
                    <CharSummary name={this.props.character_name} data={char_skills} />
                    <ISKForSPPanel
                        biology_skill_level={char_skills ? char_skills.skill_level(3405) : null}
                        millions_of_sp={char_skills ? 0 | (char_skills.total_sp / 1000000) : null}
                        biology_implant_multiplier={
                            char_skills ? char_skills.biology_implant_bonus : null
                        }
                    />
                </div>
                <div className="tab_bar">{tabs}</div>
                <div className={"tab_content" + (this.state.split_view ? " split_view" : "")}>
                    {view}
                    {this.state.split_view ? (
                        <SkillQueue key="split_view" data={char_skills} />
                    ) : null}
                </div>
            </>
        );
    }
}

function CharacterBackground(props: {character_id: number}) {
    const url = character_url(props.character_id, 512);
    const body_style = "body { background: rgba(34, 34, 47, 0.85); }";
    const html_style = `html { background-image: url('${url}'); }`;
    return <style>{body_style + html_style}</style>;
}

interface AuthenticatedContentState {
    character_id: number | null;
    character_name: string | null;
    characters: CharacterNameAndId[] | null;
    valid: boolean;
}

class AuthenticatedContent extends React.Component<
    Record<string, never>,
    AuthenticatedContentState
> {
    constructor(props) {
        super(props);
        this.state = {
            character_id: null,
            character_name: null,
            valid: true,
            characters: null,
        };
        this.on_character_select_click = this.on_character_select_click.bind(this);
        this.on_character_delete_request = this.on_character_delete_request.bind(this);
        this.invalidate_character = this.invalidate_character.bind(this);
    }

    on_character_delete_request(character_name: string) {
        this.delete_character(character_name);
    }

    async delete_character(character_name: string) {
        if (this.state.characters === null) {
            return;
        }
        let character_id: null | number = null;
        for (const char of this.state.characters) {
            if (char.name == character_name) {
                character_id = char.id;
                break;
            }
        }
        if (character_id === null) {
            return;
        }
        if (
            window.confirm(
                `Are you sure you want to remove ${character_name} from capsuleer.app?`
            ) === false
        ) {
            return;
        }
        const previous_characters = this.state.characters;
        this.setState({characters: null});
        try {
            await delete_character(character_id);
        } catch {
            this.setState({characters: previous_characters});
            return;
        }
        await this.componentDidMount();
    }

    async componentDidMount() {
        let new_state;
        try {
            new_state = {characters: await download_characters()};
        } catch (exc) {
            if (exc instanceof NeedsLoginError) {
                window.show_login();
                return;
            }
            throw exc;
        }
        if (this.state.character_id == null) {
            const first_character = new_state.characters[0];
            new_state.character_id = first_character.id;
            new_state.character_name = first_character.name;
            new_state.valid = first_character.valid;
        }
        this.setState(new_state);
    }

    on_character_select_click(id: number, name: string, valid: boolean) {
        this.setState({character_id: id, character_name: name, valid});
    }

    invalidate_character(id: number) {
        if (this.state.characters == undefined) {
            throw Error("Can't invalidate characters, there are none");
        }
        const characters = this.state.characters.slice();
        const idx = characters.findIndex((c) => c.id == id);
        if (idx == -1) {
            throw Error("character_id doesn't seem to exist");
        }
        const c = characters[idx];
        const replacement: CharacterNameAndId = {id: c.id, name: c.name, valid: false};
        characters[idx] = replacement;

        const new_state = {characters, valid: this.state.valid};

        if (this.state.character_id == id) {
            new_state.valid = false;
        }

        this.setState(new_state);
    }

    render() {
        if (!this.state.character_id || !this.state.characters) {
            return (
                <>
                    <header>
                        <h1>capsuleer.app</h1>
                    </header>
                    <div>
                        <img src="s/loading.svg" />
                    </div>
                </>
            );
        }

        const body = this.state.valid ? (
            <Body
                character_name={this.state.character_name!}
                character_id={this.state.character_id}
                invalidate_character={this.invalidate_character}
            />
        ) : (
            <CharacterExpired
                on_delete_click={this.on_character_delete_request}
                character_name={this.state.character_name!}
            />
        );

        return (
            <>
                <Header
                    characters={this.state.characters}
                    selected={this.state.character_id}
                    on_character_select={this.on_character_select_click}
                />
                {body}
                <CharacterBackground character_id={this.state.character_id} />
            </>
        );
    }
}

interface ApplicationState {
    show_login: boolean;
    show_error: boolean;
}

class Application extends React.Component<Record<string, never>, ApplicationState> {
    constructor(props) {
        super(props);
        window.show_login = this.show_login = this.show_login.bind(this);
        this.state = {
            show_login: false,
            show_error: false,
        };
    }

    show_login() {
        this.setState({show_login: true});
    }

    static getDerivedStateFromError(error) {
        if (error instanceof NeedsLoginError) {
            return {show_login: true, character_id: null};
        }
        return {show_error: true};
    }

    render() {
        if (this.state.show_error) {
            return (
                <h1>
                    Something went wrong, sorry! Please send a description of what happened to
                    Vaeltek in-game. Thanks!
                </h1>
            );
        }
        if (this.state.show_login) {
            return (
                <>
                    <header>
                        <h1>capsuleer.app</h1>
                    </header>
                    <LoginForm />
                </>
            );
        }

        return <AuthenticatedContent />;
    }
}

function render() {
    ReactDOM.render(
        <React.StrictMode>
            <Application />
        </React.StrictMode>,
        document.querySelector("#app")
    );
}

if (document.readyState != "loading") {
    render();
} else {
    document.addEventListener("DOMContentLoaded", render, false);
}
