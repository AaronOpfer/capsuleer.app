import React from "react";

interface CharacterExpiredProps {
    character_name: string;
}

export default class CharacterExpired extends React.PureComponent<CharacterExpiredProps, {}> {
    render() {
        return (
            <div className="character_expired">
                <h3>Log in with {this.props.character_name} again</h3>
                <a href="/auth" target="_blank">
                    <img src="https://web.ccpgamescdn.com/eveonlineassets/developers/eve-sso-login-white-large.png" />
                </a>
                <p>
                    capsuleer.app no longer has valid access to this character. Log in with this
                    character again to update it.
                </p>
            </div>
        );
    }
}
