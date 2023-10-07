export type TimeoutHandle = {
    cancel: () => void;
};

export function setTimeoutWithVisibility(callback: () => void, delay: number): TimeoutHandle {
    const doNothing = () => {};
    const timeoutId = setTimeout(() => {
        if (handle.cancel === doNothing) {
            return;
        }
        if (!document.hidden) {
            callback();
            handle.cancel = doNothing;
        } else {
            const listenerFxn = () => {
                if (handle.cancel === doNothing) {
                    return;
                }
                if (!document.hidden) {
                    callback();
                    handle.cancel = doNothing;
                }
            };
            document.addEventListener("visibilitychange", listenerFxn);
            handle.cancel = () => {
                document.removeEventListener("visibilitychange", listenerFxn);
                handle.cancel = doNothing;
            };
        }
    }, delay);

    const handle: TimeoutHandle = {
        cancel: () => {
            clearTimeout(timeoutId);
            handle.cancel = doNothing;
        },
    };

    return handle;
}
