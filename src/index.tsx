"use strict";

import React from "react";
import ReactDOM from "react-dom";
import {character_url} from "./misc/urls";
import CharacterSkills from "./character_skills";
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
import Header from "./components/header/header";
import SkillBrowser from "./components/skill_browser";
import CharSummary from "./components/char_summary";
import Wallet from "./components/wallet";

interface BodyProps {
    character_name: string;
    character_id: number;
    invalidate_character: any;
}

enum CurrentView {
    none = 0,
    skillQueue,
    skillBrowser,
    wallet,
}

interface BodyState {
    char_skills: CharacterSkills | null;
    view: CurrentView;
}

class Body extends React.Component<BodyProps, BodyState> {
    update_interval: any | null;

    constructor(props: any) {
        super(props);
        this.state = {
            char_skills: null,
            view: CurrentView.skillQueue,
        };
        this.update_interval = null;
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        const state = this.state;
        if (prevProps.character_id != this.props.character_id) {
            this.load_character_data();
        }
    }

    set_view(view: CurrentView) {
        this.setState({view});
    }

    async componentDidMount() {
        await this.load_character_data();
    }

    async load_character_data() {
        this.setState({char_skills: null});
        if (this.update_interval) {
            clearInterval(this.update_interval);
        }

        const character_id = this.props.character_id;

        try {
            const char_skills = await download_character_skills(character_id);
            if (this.props.character_id !== character_id) {
                return;
            }
            this.setState({
                char_skills,
            });
            if (!char_skills.skill_queue_paused) {
                this.update_interval = setInterval(() => {
                    char_skills.update();
                    this.forceUpdate();
                }, 1000);
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
                view = <SkillQueue data={char_skills} />;
                break;
            case CurrentView.none:
                break;
            case CurrentView.wallet:
                view = <Wallet character_id={this.props.character_id} />;
                break;
            case CurrentView.skillBrowser:
                view = <SkillBrowser data={char_skills} />;
                break;
        }

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
                <div className="tab">
                    <div
                        className={this.state.view == CurrentView.skillQueue ? "active" : undefined}
                        onClick={(e) => this.set_view(CurrentView.skillQueue)}
                    >
                        Skill Queue
                    </div>
                    <div
                        className={
                            this.state.view == CurrentView.skillBrowser ? "active" : undefined
                        }
                        onClick={(e) => this.set_view(CurrentView.skillBrowser)}
                    >
                        Skills
                    </div>
                    <div
                        className={this.state.view == CurrentView.wallet ? "active" : undefined}
                        onClick={(e) => this.set_view(CurrentView.wallet)}
                    >
                        Wallet
                    </div>
                </div>
                <div className="tab_content">{view}</div>
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

class AuthenticatedContent extends React.Component<{}, AuthenticatedContentState> {
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
        let previous_characters = this.state.characters;
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

class Application extends React.Component<{}, ApplicationState> {
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

    componentDidMount() {
        window.reattempt_download = this.reattempt_download_character_data.bind(this);
    }

    reattempt_download_character_data() {
        if (this.state.show_login == false) {
            // FIXME ugly hack!
            window.location.reload();
        }
        this.setState({show_login: false});
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
