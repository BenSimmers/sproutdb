import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { table, DuplicateKeyError, ValidationError, QueryError, type Schema } from "../src";

type User = { id: number; name: string; age?: number; address?: { city: string } };

const users = (): User[] => [
    { id: 1, name: "Alice", age: 30, address: { city: "Paris" } },
    { id: 2, name: "Bob", age: 20, address: { city: "Berlin" } },
    { id: 3, name: "Carol" },
];

describe("write return values", () => {
    it("returns the inserted record and affected counts", () => {
        const t = table<User>();
        expect(t.insert({ id: 1, name: "Alice" })).toEqual({ id: 1, name: "Alice" });
        expect(t.load(users().slice(1))).toBe(2);
        expect(t.update({ where: { age: { $exists: false } } }, { age: 1 })).toBe(2);
        expect(t.update({ where: { id: 99 } }, { age: 1 })).toBe(0);
        expect(t.delete({ where: { id: { $in: [1, 2] } } })).toBe(2);
    });
});

describe("primary keys", () => {
    it("gets and upserts by key", () => {
        const t = table<User>({ key: "id" });
        t.load(users());
        expect(t.get(2)?.name).toBe("Bob");
        expect(t.get(99)).toBeUndefined();

        t.upsert({ id: 2, name: "Robert" });
        t.upsert({ id: 4, name: "Dan" });
        expect(t.get(2)).toEqual({ id: 2, name: "Robert" });
        expect(t.count()).toBe(4);
    });

    it("rejects duplicate and missing keys without changing the table", () => {
        const t = table<User>({ key: "id" });
        t.load(users());
        expect(() => t.insert({ id: 1, name: "Again" })).toThrow(DuplicateKeyError);
        expect(() => t.load([{ id: 5, name: "E" }, { id: 5, name: "E2" }])).toThrow(DuplicateKeyError);
        expect(() => t.update({ where: { id: 2 } }, { id: 1 })).toThrow(DuplicateKeyError);
        expect(() => t.insert({ name: "No id" } as User)).toThrow(ValidationError);
        expect(t.all()).toEqual(users());
    });

    it("requires the key option for get and upsert", () => {
        const t = table<User>();
        expect(() => t.get(1)).toThrow(/requires the "key" table option/);
        expect(() => t.upsert({ id: 1, name: "A" })).toThrow(/requires the "key" table option/);
    });
});

describe("queries", () => {
    const t = table<User>();
    t.load(users());
    const names = (rows: User[]) => rows.map(u => u.name);

    it("supports findOne and count", () => {
        expect(t.findOne({ where: { age: { $gte: 25 } } })?.name).toBe("Alice");
        expect(t.findOne({ where: { id: 99 } })).toBeUndefined();
        expect(t.count()).toBe(3);
        expect(t.count({ where: { age: { $exists: true } } })).toBe(2);
    });

    it("supports $and, $not, $eq and $exists", () => {
        expect(names(t.find({ where: { $and: [{ age: { $gte: 10 } }, { age: { $lt: 25 } }] } }))).toEqual(["Bob"]);
        expect(names(t.find({ where: { name: { $not: { $regex: "^A" } } } }))).toEqual(["Bob", "Carol"]);
        expect(names(t.find({ where: { address: { $eq: { city: "Paris" } } } }))).toEqual(["Alice"]);
        expect(names(t.find({ where: { age: { $exists: false } } }))).toEqual(["Carol"]);
    });

    it("supports dot-path fields in where and sort", () => {
        expect(names(t.find({ where: { "address.city": "Berlin" } }))).toEqual(["Bob"]);
        expect(names(t.find({ where: { "address.city": { $exists: false } } }))).toEqual(["Carol"]);
        expect(names(t.find({ sort: { "address.city": "asc" } as never }))).toEqual(["Bob", "Alice", "Carol"]);
    });

    it("sorts missing values last", () => {
        expect(names(t.find({ sort: { age: "asc" } }))).toEqual(["Bob", "Alice", "Carol"]);
    });

    it("projects fields with select", () => {
        const rows = t.find({ select: ["id", "name"], where: { id: { $lte: 2 } } });
        expect(rows).toEqual([{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }]);
    });

    it("throws QueryError for unknown operators and bad regexes", () => {
        expect(() => t.find({ where: { age: { $gtt: 1 } as never } })).toThrow(QueryError);
        expect(() => t.find({ where: { name: { $regex: "(" } } })).toThrow(QueryError);
    });
});

describe("validation", () => {
    const schema = z.object({ id: z.number(), name: z.string().min(1) });

    it("validates the merged record on update and leaves the table untouched on failure", () => {
        const t = table({ schema, key: "id" });
        t.load([{ id: 1, name: "A" }, { id: 2, name: "B" }]);
        expect(() => t.update({}, { name: "" })).toThrow(ValidationError);
        expect(t.all()).toEqual([{ id: 1, name: "A" }, { id: 2, name: "B" }]);
    });

    it("loads all records or none", () => {
        const t = table(schema);
        expect(() => t.load([{ id: 1, name: "A" }, { id: 2, name: "" }])).toThrow(ValidationError);
        expect(t.count()).toBe(0);
    });

    it("accepts any validator with a safeParse method", () => {
        const positive: Schema<number> = {
            safeParse: value => (typeof value === "number" && value > 0
                ? { success: true, data: value }
                : { success: false, error: { issues: [{ message: "must be positive" }] } }),
        };
        const t = table(positive);
        t.insert(1);
        expect(() => t.insert(-1)).toThrow("must be positive");
    });
});

describe("clear, restore and subscribe", () => {
    it("notifies listeners of every change until unsubscribed", () => {
        const t = table<User>({ key: "id" });
        const listener = vi.fn();
        const unsubscribe = t.subscribe(listener);

        t.insert({ id: 1, name: "A" });
        t.load([{ id: 2, name: "B" }]);
        t.update({ where: { id: 1 } }, { name: "A2" });
        t.upsert({ id: 2, name: "B2" });
        t.delete({ where: { id: 2 } });
        t.update({ where: { id: 99 } }, { name: "none" });
        t.restore([{ id: 3, name: "C" }]);
        t.clear();

        expect(listener.mock.calls.map(([event]) => [event.type, event.records.map((r: User) => r.name)])).toEqual([
            ["insert", ["A"]],
            ["insert", ["B"]],
            ["update", ["A2"]],
            ["update", ["B2"]],
            ["delete", ["B2"]],
            ["replace", ["C"]],
            ["replace", []],
        ]);

        unsubscribe();
        t.insert({ id: 4, name: "D" });
        expect(listener).toHaveBeenCalledTimes(7);
    });

    it("gives listeners copies of the records", () => {
        const t = table<User>();
        t.subscribe(event => { event.records[0].name = "mutated"; });
        t.insert({ id: 1, name: "A" });
        expect(t.all()[0].name).toBe("A");
    });

    it("restore validates before replacing", () => {
        const t = table<User>({ key: "id" });
        t.load(users());
        expect(() => t.restore([{ id: 1, name: "x" }, { id: 1, name: "y" }])).toThrow(DuplicateKeyError);
        expect(t.count()).toBe(3);
    });
});
