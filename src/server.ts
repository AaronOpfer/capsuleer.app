import CharacterSkills from "./character_skills";

export interface CharacterNameAndId {
    id: number;
    name: string;
    valid: boolean;
}

// A hack to speed up page load. There's a small script segment on the
// index which starts a fetch.
declare global {
    interface Window {
        esi_early_fetch: undefined | Promise<any>;
        show_login: any; // FIXME this is a HACK!
    }
}

export class NeedsLoginError extends Error {}
export class CharacterNeedsUpdated extends Error {}

export async function download_characters(): Promise<CharacterNameAndId[]> {
    let response;
    if (typeof window != "undefined" && window.esi_early_fetch) {
        const early_fetch = window.esi_early_fetch;
        window.esi_early_fetch = undefined;
        response = await early_fetch;
    } else {
        response = await fetch("/characters", {credentials: "same-origin"});
    }

    if (response.status == 401) {
        throw new NeedsLoginError();
    }

    return (await response.json()).map((c) => ({
        id: c[0],
        name: c[1],
        valid: c[2],
    }));
}

export async function download_character_skills(character_id: number): Promise<CharacterSkills> {
    const response = await fetch(`${character_id}/skills`, {credentials: "same-origin"});

    if (response.status == 401) {
        throw new NeedsLoginError();
    }

    if (response.status == 205) {
        throw new CharacterNeedsUpdated();
    }

    return new CharacterSkills(await response.json());
}

export interface WalletEntry {
    date: Date;
    balance: number;
    amount: number;
    description: string;
}

export async function download_wallet(character_id: number): Promise<WalletEntry[]> {
    const response = await fetch(`${character_id}/wallet`, {credentials: "same-origin"});

    if (response.status == 401) {
        throw new NeedsLoginError();
    }

    if (response.status == 205) {
        throw new CharacterNeedsUpdated();
    }

    const json = await response.json();
    if (json.length === 0) {
        return [];
    }
    let [balance, last_date, string_table, entries] = json;

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

export async function* download_character_training_progress() {
    const the_fetch = fetch("/characters/training", {credentials: "same-origin"});
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

async function* makeTextFileLineIterator(fetch_promise) {
    const utf8Decoder = new TextDecoder("utf-8");
    const response = await fetch_promise;
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
