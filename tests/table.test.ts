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
        const foundUsers = users.find({ where: { id: "1" } });
        expect(foundUsers).toHaveLength(1);
        expect(foundUsers[0].email).toBe("alice@newdomain.com");
    });
    
    it("should find a record by query", () => {
        const found = users.find({ where: { name: "Alice" } });
        expect(found).toHaveLength(1);
        expect(found[0].email).toBe("alice@example.com");
    });

    it("should delete a record", () => {
        users.delete({ where: { id: "1" } });
        expect(users.find({ where: { id: "1" } })).toHaveLength(0);
    });

    it("should be able to load records in", () => {
        const newUsers = [
            { id: "2", name: "Bob", email: "bob@example.com" },
            { id: "3", name: "Charlie", email: "charlie@example.com" },
        ];
        users.load(newUsers);
        expect(users.all()).toHaveLength(3);
    });

    it("should support sorting", () => {
        const testUsers = table<User>();
        testUsers.load([
            { id: "3", name: "Charlie", email: "charlie@example.com" },
            { id: "1", name: "Alice", email: "alice@example.com" },
            { id: "2", name: "Bob", email: "bob@example.com" },
        ]);
        
        const sorted = testUsers.find({ sort: { name: 'asc' } });
        expect(sorted[0].name).toBe("Alice");
        expect(sorted[1].name).toBe("Bob");
        expect(sorted[2].name).toBe("Charlie");
    });

    it("should support limiting", () => {
        const testUsers = table<User>();
        testUsers.load([
            { id: "1", name: "Alice", email: "alice@example.com" },
            { id: "2", name: "Bob", email: "bob@example.com" },
            { id: "3", name: "Charlie", email: "charlie@example.com" },
        ]);
        
        const limited = testUsers.find({ limit: 2 });
        expect(limited).toHaveLength(2);
    });

    it("should support offset", () => {
        const testUsers = table<User>();
        testUsers.load([
            { id: "1", name: "Alice", email: "alice@example.com" },
            { id: "2", name: "Bob", email: "bob@example.com" },
            { id: "3", name: "Charlie", email: "charlie@example.com" },
        ]);
        
        const offset = testUsers.find({ offset: 1 });
        expect(offset).toHaveLength(2);
        expect(offset[0].name).toBe("Bob");
    });

    it("should support range queries", () => {
        const testUsers = table<{ id: number; name: string; age: number }>();
        testUsers.load([
            { id: 1, name: "Alice", age: 25 },
            { id: 2, name: "Bob", age: 30 },
            { id: 3, name: "Charlie", age: 35 },
        ]);
        
        const adults = testUsers.find({ where: { age: { $gte: 30 } } });
        expect(adults).toHaveLength(2);
        expect(adults.map(u => u.name)).toEqual(["Bob", "Charlie"]);
    });

    it("should support OR logic", () => {
        const testUsers = table<User>();
        testUsers.load([
            { id: "1", name: "Alice", email: "alice@example.com" },
            { id: "2", name: "Bob", email: "bob@example.com" },
            { id: "3", name: "Charlie", email: "charlie@example.com" },
        ]);
        
        const result = testUsers.find({ where: { $or: [{ name: "Alice" }, { name: "Charlie" }] } });
        expect(result).toHaveLength(2);
        expect(result.map(u => u.name)).toEqual(["Alice", "Charlie"]);
    });

    it("should support regex matching", () => {
        const testUsers = table<User>();
        testUsers.load([
            { id: "1", name: "Alice", email: "alice@example.com" },
            { id: "2", name: "Bob", email: "bob@example.com" },
            { id: "3", name: "Charlie", email: "charlie@example.com" },
        ]);
        
        const result = testUsers.find({ where: { email: { $regex: /example\.com$/ } } });
        expect(result).toHaveLength(3);
    });
});
