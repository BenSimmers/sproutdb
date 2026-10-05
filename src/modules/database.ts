import { type Database, type Snapshot, type TableRecord } from "../lib/types";

export const snapshot = <TTables extends TableRecord>(db: Database<TTables>): Snapshot =>
    Object.fromEntries(Object.entries(db).map(([name, t]) => [name, [...t.all()]]));

export const restore = <TTables extends TableRecord>(db: Database<TTables>, data: Snapshot): void => {
    for (const [name, t] of Object.entries(db)) {
        t.restore(data[name] ?? []);
    }
};

export const transaction = <TTables extends TableRecord, R>(db: Database<TTables>, fn: (db: Database<TTables>) => R): R => {
    const before = snapshot(db);
    try {
        const result = fn(db);
        if (result instanceof Promise) {
            throw new Error('transaction() callbacks must be synchronous');
        }
        return result;
    } catch (error) {
        restore(db, before);
        throw error;
    }
};
