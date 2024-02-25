import React from "react";

export default class LoginForm extends React.PureComponent<
    Record<string, never>,
    Record<string, never>
> {
    render() {
        return (
            <div className="login">
                <img className="phone" src="/s/phone.png" alt="Sample" />
                <div className="login_content">
                    <h3>Login to view your character&apos;s skills</h3>
                    <a href="/auth">
                        <img src="https://web.ccpgamescdn.com/eveonlineassets/developers/eve-sso-login-white-large.png" />
                    </a>
                    <p className="boring_privacy">
                        By logging in, you agree to capsuleer.app using cookies to identify you
                        between visits and remember your character information.
                    </p>
                    <p>
                        Tie all of your characters into one convenient SSO login. No email required!
                    </p>
                    <p>
                        See all of your characters&apos; skill plans and evaluate effectiveness of
                        skill injectors and cerebral accelerators.
                    </p>
                </div>
            </div>
        );
    }
}
