import {Component} from "preact/compat";
import {request_manager, OverlayState} from "../server";

export default class ConnectionOverlay extends Component<Record<string, never>, OverlayState> {
    unsubscribe: (() => void) | null = null;

    constructor(props) {
        super(props);
        this.state = {visible: false, offline: false, can_retry_now: false};
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
        const {offline, can_retry_now} = this.state;
        return (
            <div className="connection_overlay">
                {offline ? "You are currently offline." : "Connection problem: will retry soon."}
                <button disabled={!can_retry_now} onClick={this.on_retry_now}>
                    {can_retry_now ? (offline ? "Check now" : "Retry now") : "Retrying..."}
                </button>
            </div>
        );
    }
}
