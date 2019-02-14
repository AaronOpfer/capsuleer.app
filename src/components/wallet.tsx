import React from "react";
import {format_with_decimals} from "../misc/formatting";
import {download_wallet, WalletEntry} from "../server";

interface WalletProps {
    character_id: number;
}

interface WalletState {
    page: number;
    entries: WalletEntry[] | null;
}

const fmt = (x) => format_with_decimals(x, 0);

export default class Wallet extends React.Component<WalletProps, WalletState> {
    constructor(props) {
        super(props);
        this.state = {
            page: 0,
            entries: null,
        };
    }

    componentDidMount() {
        this.download_wallet();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.character_id != this.props.character_id) {
            this.setState({entries: null, page: 0});
            this.download_wallet();
        }
    }

    async download_wallet() {
        const character_id = this.props.character_id;
        const wallet_entries = await download_wallet(character_id);
        if (this.props.character_id != character_id) {
            return;
        }
        this.setState({entries: wallet_entries});
    }

    render() {
        let entries;

        if (this.state.entries === null) {
            entries = (
                <tr>
                    <td className="wallet_notice" colSpan={4}>
                        Loading wallet content...
                    </td>
                </tr>
            );
        } else if (this.state.entries.length === 0) {
            entries = (
                <tr>
                    <td className="wallet_notice" colSpan={4}>
                        No wallet activity in the last three months.
                    </td>
                </tr>
            );
        } else {
            entries = this.state.entries.map((e, idx) => (
                <tr key={idx}>
                    <td>{e.date.toLocaleString()}</td>
                    <td className={"np"[+(e.amount > 0)]}>{fmt(e.amount)}</td>
                    <td>{fmt(e.balance)}</td>
                    <td className="d">{e.description}</td>
                </tr>
            ));
        }

        return (
            <div className="wallet">
                <table className="wallet_table">
                    <thead>
                        <tr>
                            <th>date</th>
                            <th>amount</th>
                            <th>balance</th>
                            <th className="d">description</th>
                        </tr>
                    </thead>
                    <tbody>{entries}</tbody>
                </table>
            </div>
        );
    }
}
