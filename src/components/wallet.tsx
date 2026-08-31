import {Component} from "preact/compat";
import {format_with_decimals} from "../misc/formatting";
import {
    request_manager,
    NeedsLoginError,
    CharacterNeedsUpdated,
    LoadingState,
    WalletEntry,
} from "../server";

interface WalletProps {
    character_id: number;
    invalidate_character: (character_id: number) => void;
}

interface WalletState {
    page: number;
    entries: WalletEntry[] | null;
    loading_state: LoadingState | null;
}

const fmt = (x) => format_with_decimals(x, 0);

export default class Wallet extends Component<WalletProps, WalletState> {
    constructor(props) {
        super(props);
        this.state = {
            page: 0,
            entries: null,
            loading_state: null,
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
        try {
            const wallet_entries = await request_manager.download_wallet(
                character_id,
                (loading_state) => this.setState({loading_state}),
            );
            if (this.props.character_id != character_id) {
                return;
            }
            this.setState({entries: wallet_entries, loading_state: null});
        } catch (err) {
            if (err instanceof CharacterNeedsUpdated) {
                this.props.invalidate_character(character_id);
                return;
            }
            if (err instanceof NeedsLoginError) {
                return;
            }
            throw err;
        }
    }

    render() {
        let entries;

        if (this.state.entries === null) {
            entries = (
                <tr>
                    <td
                        className={
                            "wallet_notice" +
                            (this.state.loading_state === "waiting" ? " waiting" : "")
                        }
                        colSpan={4}
                    >
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
            entries = this.state.entries.map((e) => (
                <tr key={e.date.getTime()}>
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
