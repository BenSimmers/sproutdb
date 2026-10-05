import { type Database, type Snapshot, type TableRecord } from "../lib/types";
import { restore, snapshot } from "./database";

/**
 * Somewhere to keep a database snapshot between runs.
 */
export interface StorageAdapter {
    read(): Snapshot | undefined;
    write(data: Snapshot): void;
}

export interface PersistHandle {
    save(): void;
    stop(): void;
}
export const persist = <TTables extends TableRecord>(db: Database<TTables>, adapter: StorageAdapter): PersistHandle => {
    const saved = adapter.read();
    if (saved) {
        restore(db, saved);
    }

    const save = () => adapter.write(snapshot(db));
    const unsubscribes = Object.values(db).map(t => t.subscribe(save));

    return {
        save,
        stop: () => unsubscribes.forEach(unsubscribe => unsubscribe()),
    };
};

export const memoryAdapter = (initial?: Snapshot): StorageAdapter & { data: Snapshot | undefined } => {
    const adapter = {
        data: initial ? structuredClone(initial) : undefined,
        read: () => (adapter.data ? structuredClone(adapter.data) : undefined),
        write: (data: Snapshot) => { adapter.data = structuredClone(data); },
    };
    return adapter;
};

export const localStorageAdapter = (
    key: string,
    storage: Pick<Storage, 'getItem' | 'setItem'> = globalThis.localStorage,
): StorageAdapter => ({
    read: () => {
        const raw = storage.getItem(key);
        return raw === null ? undefined : JSON.parse(raw);
    },
    write: data => storage.setItem(key, JSON.stringify(data)),
});
