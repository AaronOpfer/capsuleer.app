import React from "react";

interface CharacterExpiredProps {
    character_name: string;
    on_delete_click: (character_name: string) => void;
}

export default class CharacterExpired extends React.PureComponent<
    CharacterExpiredProps,
    Record<string, never>
> {
    constructor(props) {
        super(props);
        this.on_click = this.on_click.bind(this);
    }

    on_click(e: React.MouseEvent) {
        this.props.on_delete_click(this.props.character_name);
        e.preventDefault();
    }

    render() {
        return (
            <div className="character_expired">
                <h3>Log in with {this.props.character_name} again</h3>
                <a href="/auth">
                    <img src="https://web.ccpgamescdn.com/eveonlineassets/developers/eve-sso-login-white-large.png" />
                </a>
                <p>
                    capsuleer.app no longer has valid access to this character. Log in with this
                    character again to update it.
                </p>
                <p>
                    Alternatively, you can{" "}
                    <a onClick={this.on_click} href="" className="delete_character">
                        remove the character.
                    </a>
                    .
                </p>
            </div>
        );
    }
}
