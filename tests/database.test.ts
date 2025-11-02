import { describe, beforeEach, afterEach, it, expect } from "vitest";
import { table, create } from "../src";
import { arrayOrSingle } from "./helpers/arrayOrSingle";

type User = {
    id: string;
    name: string;
    email: string;
};

type Post = {
    id: string;
    title: string;
    content: string;
};

describe("creating a database with multiple tables", () => {
    const db = create({
        users: table<User>(),
        posts: table<Post>(),
    });

    beforeEach(() => {
        db.users.insert({ id: "1", name: "Alice", email: "alice@example.com" });
        db.posts.insert({ id: "1", title: "Hello World", content: "This is my first post!" });
    });

    afterEach(() => {
        db.posts.delete({ where: { id: "1" } });
        db.users.delete({ where: { id: "1" } });
    });

    it("should create multiple tables in a database", () => {
        expect(db.users).toBeDefined();
        expect(db.posts).toBeDefined();

        expect(db.users.all()).toHaveLength(1);
        expect(db.posts.all()).toHaveLength(1);
    });


    it("should insert a record into the users table", () => {
        db.users.insert({ id: "2", name: "Bob", email: "bob@example.com" });
        expect(db.users.all()).toHaveLength(2);
    });

    it("should be able to update a record in the table", () => {
        db.users.update({ where: { id: "1" } }, { email: "alice@newdomain.com" });
        const foundUser = db.users.find({ where: { id: "1" } });
        arrayOrSingle(foundUser).forEach(user => {
            expect(user.email).toBe("alice@newdomain.com");
        });
    });

    it("should be able to find a record in the table", () => {
        const user = db.users.find({ where: { id: "1" } });
        expect(user).toBeDefined();
        arrayOrSingle(user).forEach(u => {
            expect(u.name).toBe("Alice");
        });

    });
});
