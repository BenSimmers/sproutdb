import { describe, it, expect } from "vitest";
import { table } from "../src";

type Row = {
    id: number;
    age: number | null;
    meta: { a: number };
    tags: string[];
    createdAt: Date;
};

const rows = (): Row[] => [
    { id: 1, age: 20, meta: { a: 1 }, tags: ["x"], createdAt: new Date("2024-01-01") },
    { id: 2, age: 40, meta: { a: 2 }, tags: ["y", "z"], createdAt: new Date("2025-01-01") },
    { id: 3, age: null, meta: { a: 1 }, tags: [], createdAt: new Date("2025-01-01") },
];

const ids = (result: Row[]) => result.map(r => r.id);

describe("query matching", () => {
    it("combines $or with other field conditions", () => {
        const t = table<Row>();
        t.load(rows());
        expect(ids(t.find({ where: { id: 1, $or: [{ age: 40 }] } }))).toEqual([]);
        expect(ids(t.find({ where: { id: 2, $or: [{ age: 40 }, { age: 20 }] } }))).toEqual([2]);
    });

    it("matches nested objects, arrays and dates by value", () => {
        const t = table<Row>();
        t.load(rows());
        expect(ids(t.find({ where: { meta: { a: 999 } } }))).toEqual([]);
        expect(ids(t.find({ where: { meta: { a: 1 } } }))).toEqual([1, 3]);
        expect(ids(t.find({ where: { tags: ["y", "z"] } }))).toEqual([2]);
        expect(ids(t.find({ where: { createdAt: new Date("2025-01-01") } }))).toEqual([2, 3]);
    });

    it("supports null in $ne and equality", () => {
        const t = table<Row>();
        t.load(rows());
        expect(ids(t.find({ where: { age: { $ne: null } } }))).toEqual([1, 2]);
        expect(ids(t.find({ where: { age: null } }))).toEqual([3]);
    });

    it("supports $in with object values", () => {
        const t = table<Row>();
        t.load(rows());
        expect(ids(t.find({ where: { meta: { $in: [{ a: 2 }] } } }))).toEqual([2]);
    });

    it("respects limit: 0 and offset: 0", () => {
        const t = table<Row>();
        t.load(rows());
        expect(t.find({ limit: 0 })).toHaveLength(0);
        expect(t.find({ offset: 0, limit: 1 })).toHaveLength(1);
    });

    it("applies where to update and delete with $or plus fields", () => {
        const t = table<Row>();
        t.load(rows());
        t.update({ where: { id: 1, $or: [{ age: 40 }] } }, { age: 99 });
        expect(t.all().map(r => r.age)).toEqual([20, 40, null]);
        t.delete({ where: { id: 1, $or: [{ age: 40 }] } });
        expect(t.all()).toHaveLength(3);
    });
});

describe("isolation from caller mutations", () => {
    it("does not expose internal records via all() or find()", () => {
        const t = table<Row>();
        t.load(rows());
        t.all()[0].age = 99;
        t.find({ where: { id: 1 } })[0].meta.a = 99;
        (t.all() as Row[]).push(rows()[0]);
        const stored = t.find({ where: { id: 1 } })[0];
        expect(stored.age).toBe(20);
        expect(stored.meta.a).toBe(1);
        expect(t.all()).toHaveLength(3);
    });

    it("does not keep references to inserted, loaded or update objects", () => {
        const t = table<Row>();
        const inserted = rows()[0];
        const loaded = rows().slice(1);
        t.insert(inserted);
        t.load(loaded);
        inserted.age = 99;
        loaded[0].age = 99;

        const update = { meta: { a: 5 } };
        t.update({ where: { id: 3 } }, update);
        update.meta.a = 99;

        expect(t.all().map(r => r.age)).toEqual([20, 40, null]);
        expect(t.find({ where: { id: 3 } })[0].meta.a).toBe(5);
    });
});
