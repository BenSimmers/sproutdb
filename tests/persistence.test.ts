import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
    create,
    table,
    snapshot,
    restore,
    transaction,
    persist,
    memoryAdapter,
    localStorageAdapter,
    DuplicateKeyError,
} from "../src";
import { jsonFileAdapter } from "../src/node";

type User = { id: number; name: string };
type Post = { id: number; title: string };

const makeDb = () => create({
    users: table<User>({ key: "id" }),
    posts: table<Post>(),
});

describe("snapshot and restore", () => {
    it("round-trips every table", () => {
        const db = makeDb();
        db.users.insert({ id: 1, name: "A" });
        db.posts.insert({ id: 1, title: "Hello" });
        const saved = snapshot(db);

        db.users.clear();
        db.posts.insert({ id: 2, title: "Later" });
        restore(db, saved);

        expect(snapshot(db)).toEqual({ users: [{ id: 1, name: "A" }], posts: [{ id: 1, title: "Hello" }] });
    });

    it("clears tables missing from the snapshot", () => {
        const db = makeDb();
        db.posts.insert({ id: 1, title: "Hello" });
        restore(db, { users: [{ id: 1, name: "A" }] });
        expect(db.posts.count()).toBe(0);
    });
});

describe("transaction", () => {
    it("returns the callback's result", () => {
        const db = makeDb();
        expect(transaction(db, tx => tx.users.insert({ id: 1, name: "A" }))).toEqual({ id: 1, name: "A" });
        expect(db.users.count()).toBe(1);
    });

    it("rolls back every table when the callback throws", () => {
        const db = makeDb();
        db.users.insert({ id: 1, name: "A" });

        expect(() => transaction(db, tx => {
            tx.posts.insert({ id: 1, title: "Hello" });
            tx.users.insert({ id: 1, name: "Duplicate" });
        })).toThrow(DuplicateKeyError);

        expect(snapshot(db)).toEqual({ users: [{ id: 1, name: "A" }], posts: [] });
    });

    it("rejects async callbacks", () => {
        const db = makeDb();
        expect(() => transaction(db, async () => {})).toThrow(/synchronous/);
    });
});

describe("persist", () => {
    it("loads saved data and saves every change", () => {
        const adapter = memoryAdapter({ users: [{ id: 1, name: "Saved" }], posts: [] });
        const db = makeDb();
        const handle = persist(db, adapter);

        expect(db.users.all()).toEqual([{ id: 1, name: "Saved" }]);

        db.posts.insert({ id: 1, title: "New" });
        expect(adapter.data?.posts).toEqual([{ id: 1, title: "New" }]);

        handle.stop();
        db.posts.clear();
        expect(adapter.data?.posts).toHaveLength(1);
    });

    it("works with localStorage-like storage", () => {
        const store = new Map<string, string>();
        const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };

        const first = makeDb();
        persist(first, localStorageAdapter("app", storage));
        first.users.insert({ id: 1, name: "A" });

        const second = makeDb();
        persist(second, localStorageAdapter("app", storage));
        expect(second.users.all()).toEqual([{ id: 1, name: "A" }]);
    });

    it("works with a JSON file", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sproutdb-"));
        const file = path.join(dir, "nested", "db.json");
        try {
            const first = makeDb();
            persist(first, jsonFileAdapter(file));
            first.users.insert({ id: 1, name: "A" });
            expect(JSON.parse(fs.readFileSync(file, "utf-8")).users).toEqual([{ id: 1, name: "A" }]);

            const second = makeDb();
            persist(second, jsonFileAdapter(file));
            expect(second.users.get(1)?.name).toBe("A");
            expect(fs.readdirSync(path.dirname(file))).toEqual(["db.json"]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
