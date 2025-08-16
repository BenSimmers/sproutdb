import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { table } from "../src";

type User = {
    id: string;
    name: string;
    email: string;
};


describe("creating a table", () => {
    const users = table<User>();

    beforeEach(() => {
        users.insert({ id: "1", name: "Alice", email: "alice@example.com" });
    });

    afterEach(() => {
        users.delete({ where: { id: "1" } });
    });

    it("should create a table instance", () => {
        expect(users).toBeDefined();
    });

    it("should insert a record into the table", () => {
        const users = table<User>();
        users.insert({ id: "1", name: "Alice", email: "alice@example.com" });
        expect(users.all()).toHaveLength(1);
    });

    it("should update a record", () => {
        users.update({ where: { id: "1" } }, { email: "alice@newdomain.com" });
        expect(users.find({ where: { id: "1" } })[0].email).toBe("alice@newdomain.com");
    })

    it("should find a record by query", () => {
        const found = users.find({ where: { name: "Alice" } });
        expect(found).toHaveLength(1);
        expect(found[0].email).toBe("alice@example.com");
    });

    it("should delete a record", () => {
        users.delete({ where: { id: "1" } });
        expect(users.find({ where: { id: "1" } })).toHaveLength(0);
    });


});
