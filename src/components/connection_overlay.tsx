import {Component} from "preact/compat";
import {request_manager, OverlayState} from "../server";

export default class ConnectionOverlay extends Component<Record<string, never>, OverlayState> {
    unsubscribe: (() => void) | null = null;

    constructor(props) {
        super(props);
        this.state = {visible: false, offline: false, can_retry_now: false, downtime: false};
    }

    componentDidMount() {
        this.unsubscribe = request_manager.subscribe_overlay_state((state) => this.setState(state));
    }

    componentWillUnmount() {
        this.unsubscribe?.();
    }

    on_retry_now = () => {
        request_manager.retry_now();
    };

    render() {
        if (!this.state.visible) return null;
        const {offline, can_retry_now, downtime} = this.state;
        const message = offline
            ? "You are currently offline."
            : downtime
              ? "Some data can't be loaded due to EVE cluster downtime."
              : "Connection problem: will retry soon.";
        return (
            <div className="connection_overlay">
                {message}
                <button disabled={!can_retry_now} onClick={this.on_retry_now}>
                    {can_retry_now ? (offline ? "Check now" : "Retry now") : "Retrying..."}
                </button>
            </div>
        );
    }
}
