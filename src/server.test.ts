import {afterEach, beforeEach, expect, test, vi} from "vitest";
import {
    RequestManager,
    NeedsLoginError,
    CharacterNeedsUpdated,
    UpstreamESIError,
    throw_for_response_status,
} from "./server";

class FakeEventTarget extends EventTarget {}

beforeEach(() => {
    vi.stubGlobal("window", new FakeEventTarget());
    vi.stubGlobal("navigator", {onLine: true});
    vi.stubGlobal("document", Object.assign(new FakeEventTarget(), {hidden: false}));
    vi.useFakeTimers();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

function scripted(...steps: Array<() => unknown>) {
    let i = 0;
    return vi.fn(async () => {
        const step = steps[Math.min(i, steps.length - 1)];
        i++;
        return step();
    });
}

function ok<T>(value: T) {
    return () => value;
}

function fail(err: unknown) {
    return () => {
        throw err;
    };
}

test("run succeeds on the first try: no overlay change, no loading callback", async () => {
    const rm = new RequestManager();
    const overlay_states: Array<{visible: boolean; offline: boolean; can_retry_now: boolean}> = [];
    rm.subscribe_overlay_state((s) => overlay_states.push(s));
    const loading_states: string[] = [];

    const fn = scripted(ok("data"));
    const result = await rm.run(fn, (s) => loading_states.push(s));

    expect(result).toBe("data");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(overlay_states).toEqual([
        {visible: false, offline: false, can_retry_now: false, downtime: false},
    ]);
    expect(loading_states).toEqual([]);
});

test("overlay appears on the first failure and stays visible without flicker across retries", async () => {
    const rm = new RequestManager();
    const visible_values: boolean[] = [];
    const can_retry_values: boolean[] = [];
    rm.subscribe_overlay_state((s) => {
        visible_values.push(s.visible);
        can_retry_values.push(s.can_retry_now);
    });

    const fn = scripted(fail(new Error("1")), fail(new Error("2")), ok("data"));
    const promise = rm.run(fn, undefined, [10, 20]);

    await vi.advanceTimersByTimeAsync(10); // first retry, still fails
    await vi.advanceTimersByTimeAsync(20); // second retry, succeeds
    const result = await promise;

    expect(result).toBe("data");
    expect(fn).toHaveBeenCalledTimes(3);
    // visible goes true on the first failure and only back to false once
    // resolved -- never flickers off between retries.
    expect(visible_values).toEqual([false, true, true, true, true, true, false]);
    // can_retry_now toggles true while sleeping between attempts, false
    // while an attempt is actually in flight (nothing to cut short then).
    expect(can_retry_values).toEqual([false, false, true, false, true, false, false]);
});

test("never retries NeedsLoginError, notifies subscribe_needs_login, never touches overlay state", async () => {
    const rm = new RequestManager();
    const login_calls: number[] = [];
    rm.subscribe_needs_login(() => login_calls.push(1));
    const visible_values: boolean[] = [];
    rm.subscribe_overlay_state((s) => visible_values.push(s.visible));

    const fn = scripted(fail(new NeedsLoginError()));
    await expect(rm.run(fn)).rejects.toBeInstanceOf(NeedsLoginError);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(login_calls).toEqual([1]);
    expect(visible_values).toEqual([false]); // only the initial subscribe call
});

test("never retries CharacterNeedsUpdated, doesn't notify needs_login", async () => {
    const rm = new RequestManager();
    const login_calls: number[] = [];
    rm.subscribe_needs_login(() => login_calls.push(1));

    const fn = scripted(fail(new CharacterNeedsUpdated()));
    await expect(rm.run(fn)).rejects.toBeInstanceOf(CharacterNeedsUpdated);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(login_calls).toEqual([]);
});

test("run_generator matches run() on NeedsLoginError/CharacterNeedsUpdated", async () => {
    const rm = new RequestManager();

    async function* login_gen() {
        throw new NeedsLoginError();
        yield 1;
    }
    const gen1 = rm.run_generator(login_gen);
    await expect(gen1.next()).rejects.toBeInstanceOf(NeedsLoginError);

    async function* updated_gen() {
        throw new CharacterNeedsUpdated();
        yield 1;
    }
    const gen2 = rm.run_generator(updated_gen);
    await expect(gen2.next()).rejects.toBeInstanceOf(CharacterNeedsUpdated);
});

test("waits for the online event instead of retrying on a timer while offline", async () => {
    (navigator as {onLine: boolean}).onLine = false;
    const rm = new RequestManager();
    const fn = scripted(ok("data"));
    const loading_states: string[] = [];

    const promise = rm.run(fn, (s) => loading_states.push(s));
    await vi.waitFor(() => expect(loading_states).toEqual(["waiting"]));
    expect(fn).not.toHaveBeenCalled();

    (navigator as {onLine: boolean}).onLine = true;
    window.dispatchEvent(new Event("online"));
    await promise;

    expect(fn).toHaveBeenCalledTimes(1);
    expect(loading_states).toEqual(["waiting", "loading"]);
});

test("concurrent operations: overlay stays visible until every operation has recovered", async () => {
    const rm = new RequestManager();
    const visible_values: boolean[] = [];
    rm.subscribe_overlay_state((s) => visible_values.push(s.visible));

    const fn_a = scripted(fail(new Error("a1")), ok("a-data"));
    const fn_b = scripted(fail(new Error("b1")), ok("b-data"));

    const promise_a = rm.run(fn_a, undefined, [10]);
    const promise_b = rm.run(fn_b, undefined, [5000]);

    await vi.waitFor(() => expect(fn_a).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(fn_b).toHaveBeenCalledTimes(1));
    expect(visible_values.at(-1)).toBe(true);

    await vi.advanceTimersByTimeAsync(10);
    await promise_a;
    // a recovered, but b (5000ms) is still failing -- must not flicker off
    expect(visible_values.slice(1)).not.toContain(false);

    await vi.advanceTimersByTimeAsync(5000);
    await promise_b;
    expect(visible_values.at(-1)).toBe(false); // both recovered
});

test("retry_now cuts short an in-progress backoff wait immediately", async () => {
    const rm = new RequestManager();
    const fn = scripted(fail(new Error("x")), ok("data"));
    const loading_states: string[] = [];

    const promise = rm.run(fn, (s) => loading_states.push(s));
    await vi.waitFor(() => expect(loading_states.at(-1)).toBe("waiting"));
    rm.retry_now();
    const result = await promise;

    expect(result).toBe("data");
    expect(fn).toHaveBeenCalledTimes(2);
});

test("retry_now cuts short an in-progress offline wait even while navigator.onLine stays false", async () => {
    (navigator as {onLine: boolean}).onLine = false;
    const rm = new RequestManager();
    const fn = scripted(ok("data"));
    const loading_states: string[] = [];

    const promise = rm.run(fn, (s) => loading_states.push(s));
    await vi.waitFor(() => expect(loading_states).toEqual(["waiting"]));
    rm.retry_now();
    const result = await promise;

    expect(result).toBe("data");
    expect(fn).toHaveBeenCalledTimes(1);
});

test("keeps retrying forever past the short bursts, at a random 45-75s interval, never rejecting", async () => {
    const random_spy = vi.spyOn(Math, "random");
    const rm = new RequestManager();

    const fn = scripted(
        fail(new Error("1")),
        fail(new Error("2")),
        fail(new Error("3")),
        fail(new Error("4")),
        fail(new Error("5")),
        ok("data"),
    );
    const promise = rm.run(fn);

    await vi.advanceTimersByTimeAsync(1000); // call#2 fails, computes attempt1 delay=3000 (no random)
    await vi.advanceTimersByTimeAsync(3000); // call#3 fails, computes attempt2 delay=8000 (no random)

    random_spy.mockReturnValue(0); // set before the advance that triggers attempt3's random() call
    await vi.advanceTimersByTimeAsync(8000); // call#4 fails, past short bursts now -> delay = 45000 + 0*30000 = 45000

    random_spy.mockReturnValue(0.999999); // set before the advance that triggers attempt4's random() call
    await vi.advanceTimersByTimeAsync(45000); // call#5 fails -> delay = 45000 + 0.999999*30000 ~= 74999.97
    await vi.advanceTimersByTimeAsync(75000); // fires that wait -> call#6 finally succeeds

    const result = await promise;
    expect(result).toBe("data");
    expect(fn).toHaveBeenCalledTimes(6);

    random_spy.mockRestore();
});

test("UpstreamESIError skips the short bursts immediately and flags the overlay as downtime", async () => {
    const random_spy = vi.spyOn(Math, "random").mockReturnValue(0);
    const rm = new RequestManager();
    const overlay_states: Array<{visible: boolean; downtime: boolean}> = [];
    rm.subscribe_overlay_state((s) =>
        overlay_states.push({visible: s.visible, downtime: s.downtime}),
    );

    const fn = scripted(fail(new UpstreamESIError(true)), ok("data"));
    const promise = rm.run(fn, undefined, [1000, 3000, 8000]);

    // even on the very first failure (attempt 0, well within the short-burst
    // range) the delay should already be the long 45-75s one, not 1000ms.
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(1); // not yet retried

    await vi.advanceTimersByTimeAsync(44000); // total 45000 -> fires
    const result = await promise;

    expect(result).toBe("data");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(overlay_states.some((s) => s.downtime)).toBe(true);
    expect(overlay_states.at(-1)).toEqual({visible: false, downtime: false});

    random_spy.mockRestore();
});

test("UpstreamESIError with likely_downtime=false behaves like an ordinary error", async () => {
    const rm = new RequestManager();
    const overlay_states: Array<{downtime: boolean}> = [];
    rm.subscribe_overlay_state((s) => overlay_states.push({downtime: s.downtime}));

    const fn = scripted(fail(new UpstreamESIError(false)), ok("data"));
    const promise = rm.run(fn, undefined, [1000, 3000, 8000]);

    await vi.advanceTimersByTimeAsync(1000); // short-burst delay, not the long one
    const result = await promise;

    expect(result).toBe("data");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(overlay_states.some((s) => s.downtime)).toBe(false);
});

test("throw_for_response_status treats a marked 503 body as UpstreamESIError", async () => {
    const response = new Response(
        JSON.stringify({error: "esi_unavailable", likely_downtime: true}),
        {
            status: 503,
        },
    );
    await expect(throw_for_response_status(response)).rejects.toEqual(new UpstreamESIError(true));
});

test("throw_for_response_status treats an unmarked/non-JSON 503 (e.g. from nginx) as an ordinary error", async () => {
    const json_response = new Response(JSON.stringify({some: "other shape"}), {status: 503});
    await expect(throw_for_response_status(json_response)).rejects.not.toBeInstanceOf(
        UpstreamESIError,
    );

    const html_response = new Response("<html>503 Service Unavailable</html>", {status: 503});
    await expect(throw_for_response_status(html_response)).rejects.not.toBeInstanceOf(
        UpstreamESIError,
    );
});
