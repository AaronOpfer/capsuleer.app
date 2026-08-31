import CharacterSkills from "./character_skills";
import {setTimeoutWithVisibility} from "./misc/visibilitytimeout";

export interface CharacterNameAndId {
    id: number;
    name: string;
    valid: boolean;
}

// A hack to speed up page load. There's a small script segment on the
// index which starts a fetch.
declare global {
    interface Window {
        early_download_characters: undefined | ReturnType<typeof fetch>;
        early_download_character_training_progress: undefined | ReturnType<typeof fetch>;
    }
}

export class NeedsLoginError extends Error {}
export class CharacterNeedsUpdated extends Error {}

function throw_for_response_status(response: Response): void {
    if (response.status == 401) {
        throw new NeedsLoginError();
    }
    if (response.status == 205) {
        throw new CharacterNeedsUpdated();
    }
}

export type LoadingState = "loading" | "waiting";

export interface OverlayState {
    visible: boolean;
    offline: boolean;
    can_retry_now: boolean;
}

export class RequestManager {
    private problem_count = 0;
    private sleeping_count = 0;
    private overlay_listeners = new Set<(state: OverlayState) => void>();
    private needs_login_listeners = new Set<() => void>();
    private retry_now_target = new EventTarget();

    constructor() {
        if (typeof window !== "undefined") {
            window.addEventListener("online", () => this.emit_overlay_state());
            window.addEventListener("offline", () => this.emit_overlay_state());
        }
    }

    private is_online(): boolean {
        return typeof navigator === "undefined" || navigator.onLine;
    }

    private overlay_state(): OverlayState {
        return {
            visible: this.problem_count > 0,
            offline: !this.is_online(),
            can_retry_now: this.sleeping_count > 0,
        };
    }

    private emit_overlay_state() {
        const state = this.overlay_state();
        for (const l of this.overlay_listeners) l(state);
    }

    private mark_problem() {
        this.problem_count++;
        if (this.problem_count === 1) this.emit_overlay_state();
    }

    private clear_problem() {
        this.problem_count--;
        if (this.problem_count === 0) this.emit_overlay_state();
    }

    private mark_sleeping() {
        this.sleeping_count++;
        if (this.sleeping_count === 1) this.emit_overlay_state();
    }

    private clear_sleeping() {
        this.sleeping_count--;
        if (this.sleeping_count === 0) this.emit_overlay_state();
    }

    subscribe_overlay_state(listener: (state: OverlayState) => void): () => void {
        this.overlay_listeners.add(listener);
        listener(this.overlay_state());
        return () => this.overlay_listeners.delete(listener);
    }

    retry_now(): void {
        this.retry_now_target.dispatchEvent(new Event("retry"));
    }

    subscribe_needs_login(listener: () => void): () => void {
        this.needs_login_listeners.add(listener);
        return () => this.needs_login_listeners.delete(listener);
    }

    private wait_for_online(): Promise<void> {
        if (this.is_online()) return Promise.resolve();
        return new Promise((resolve) => {
            const cleanup = () => {
                window.removeEventListener("online", on_online);
                this.retry_now_target.removeEventListener("retry", on_retry_now);
            };
            const on_online = () => {
                cleanup();
                resolve();
            };
            const on_retry_now = () => {
                cleanup();
                resolve();
            };
            window.addEventListener("online", on_online);
            this.retry_now_target.addEventListener("retry", on_retry_now);
        });
    }

    private wait_with_retry_now(ms: number): Promise<void> {
        return new Promise((resolve) => {
            const handle = setTimeoutWithVisibility(() => {
                cleanup();
                resolve();
            }, ms);
            const on_retry_now = () => {
                handle.cancel();
                cleanup();
                resolve();
            };
            const cleanup = () => this.retry_now_target.removeEventListener("retry", on_retry_now);
            this.retry_now_target.addEventListener("retry", on_retry_now);
        });
    }

    private async wait_and_notify(
        notify: (state: LoadingState) => void,
        clear_debounce: () => void,
        mark_problem_once: () => void,
        on_wait: () => Promise<void>,
    ): Promise<void> {
        clear_debounce(); // don't let a stale "loading" fire mid-wait
        notify("waiting");
        mark_problem_once();
        this.mark_sleeping();
        await on_wait();
        this.clear_sleeping();
        notify("loading");
    }

    async run<T>(
        fn: () => Promise<T>,
        on_loading_state?: (state: LoadingState) => void,
        retry_delays_ms = [1000, 3000, 8000],
    ): Promise<T> {
        for await (const result of this.run_generator(
            async function* () {
                yield await fn();
            },
            on_loading_state,
            retry_delays_ms,
        )) {
            return result;
        }
        throw new Error("unreachable");
    }

    async *run_generator<T>(
        fn: () => AsyncGenerator<T>,
        on_loading_state?: (state: LoadingState) => void,
        retry_delays_ms = [1000, 3000, 8000],
    ): AsyncGenerator<T> {
        const notify = on_loading_state ?? (() => {});
        let debounce: ReturnType<typeof setTimeout> | null = setTimeout(() => {
            debounce = null;
            notify("loading");
        }, 50);
        const clear_debounce = () => {
            if (debounce) {
                clearTimeout(debounce);
                debounce = null;
            }
        };

        // latches so this call contributes at most +1 to the shared problem_count,
        // however many times it retries; finally{} pays back exactly that one increment
        let has_problem = false;
        const mark_problem_once = () => {
            if (!has_problem) {
                has_problem = true;
                this.mark_problem();
            }
        };

        try {
            for (let attempt = 0; ; attempt++) {
                if (!this.is_online()) {
                    await this.wait_and_notify(notify, clear_debounce, mark_problem_once, () =>
                        this.wait_for_online(),
                    );
                }
                try {
                    for await (const item of fn()) {
                        clear_debounce();
                        yield item;
                    }
                    return;
                } catch (err) {
                    if (err instanceof NeedsLoginError) {
                        for (const l of this.needs_login_listeners) l();
                        throw err;
                    }
                    if (err instanceof CharacterNeedsUpdated) {
                        throw err;
                    }
                    const past_short_bursts = attempt >= retry_delays_ms.length;
                    const delay = past_short_bursts
                        ? 45_000 + Math.random() * 30_000
                        : retry_delays_ms[attempt];
                    await this.wait_and_notify(notify, clear_debounce, mark_problem_once, () =>
                        this.wait_with_retry_now(delay),
                    );
                }
            }
        } finally {
            clear_debounce();
            if (has_problem) this.clear_problem();
        }
    }

    async download_characters(
        on_loading_state?: (state: LoadingState) => void,
    ): Promise<CharacterNameAndId[]> {
        return this.run(async () => {
            let response;
            if (typeof window != "undefined" && window.early_download_characters) {
                const early_fetch = window.early_download_characters;
                window.early_download_characters = undefined;
                response = await early_fetch;
            } else {
                response = await fetch("/characters", {credentials: "same-origin"});
            }
            throw_for_response_status(response);
            return (await response.json()).map((c) => ({
                id: c[0],
                name: c[1],
                valid: c[2],
            }));
        }, on_loading_state);
    }

    async download_character_skills(
        character_id: number,
        on_loading_state?: (state: LoadingState) => void,
    ): Promise<CharacterSkills> {
        return this.run(async () => {
            const response = await fetch(`${character_id}/skills`, {credentials: "same-origin"});
            throw_for_response_status(response);
            return new CharacterSkills(await response.json());
        }, on_loading_state);
    }

    async download_wallet(
        character_id: number,
        on_loading_state?: (state: LoadingState) => void,
    ): Promise<WalletEntry[]> {
        return this.run(async () => {
            const response = await fetch(`${character_id}/wallet`, {credentials: "same-origin"});
            throw_for_response_status(response);
            const json = await response.json();
            if (json.length === 0) {
                return [];
            }
            const [starting_balance, last_date, string_table, entries] = json;
            let balance = starting_balance;

            return entries.map((e) => {
                const result = {
                    date: new Date((last_date - e[0]) * 1000),
                    balance,
                    amount: e[1],
                    description: string_table[e[2]],
                };
                balance -= result.amount;
                return result;
            });
        }, on_loading_state);
    }

    private async *raw_download_character_training_progress(): AsyncGenerator<CharacterTrainingProgress> {
        let the_fetch;
        if (typeof window != "undefined" && window.early_download_character_training_progress) {
            the_fetch = window.early_download_character_training_progress;
            window.early_download_character_training_progress = undefined;
        } else {
            the_fetch = fetch("/characters/training", {credentials: "same-origin"});
        }
        for await (const line of makeTextFileLineIterator(the_fetch)) {
            const [character_id, skill_id, level, sp, start_date, end_date] = line.split(":");
            yield {
                character_id: +character_id,
                skill_id: skill_id === undefined ? undefined : +skill_id,
                level: +level,
                sp: +sp,
                start_date: start_date ? new Date(start_date * 1000) : undefined,
                end_date: end_date ? new Date(end_date * 1000) : undefined,
            } as CharacterTrainingProgress;
        }
    }

    download_character_training_progress(
        on_loading_state?: (state: LoadingState) => void,
    ): AsyncGenerator<CharacterTrainingProgress> {
        return this.run_generator(
            () => this.raw_download_character_training_progress(),
            on_loading_state,
        );
    }
}

export const request_manager = new RequestManager();

export interface WalletEntry {
    date: Date;
    balance: number;
    amount: number;
    description: string;
}

export async function delete_character(character_id: number): Promise<void> {
    const response = await fetch("/" + character_id, {
        method: "DELETE",
        credentials: "same-origin",
    });
    if (!response.ok) {
        throw Error(await response.text());
    }
}

export interface CharacterTrainingProgress {
    character_id: number;
    skill_id: number | undefined;
    level: number | undefined;
    sp: number | undefined;
    start_date: Date | undefined;
    end_date: Date | undefined;
}

async function* makeTextFileLineIterator(fetch_promise) {
    const utf8Decoder = new TextDecoder("utf-8");
    const response = await fetch_promise;
    throw_for_response_status(response);
    const reader = response.body.getReader();
    let {value: chunk, done: readerDone} = await reader.read();
    chunk = chunk ? utf8Decoder.decode(chunk) : "";

    const re = /\r\n|\n|\r/gm;
    let startIndex = 0;

    for (;;) {
        const result = re.exec(chunk);
        if (!result) {
            if (readerDone) {
                break;
            }
            const remainder = chunk.substr(startIndex);
            ({value: chunk, done: readerDone} = await reader.read());
            chunk = remainder + (chunk ? utf8Decoder.decode(chunk) : "");
            startIndex = re.lastIndex = 0;
            continue;
        }
        yield chunk.substring(startIndex, result.index);
        startIndex = re.lastIndex;
    }
    if (startIndex < chunk.length) {
        // last line didn't end in a newline char
        yield chunk.substr(startIndex);
    }
}
