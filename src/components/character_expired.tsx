import React from "react";

export default class CharacterExpired extends React.PureComponent<{}, {}> {
    render() {
        return (
            <div className="characterExpird">
                <h3>Log in with this Character again</h3>
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
