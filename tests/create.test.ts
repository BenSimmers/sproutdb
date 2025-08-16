import { describe, it, expect } from "vitest";
import { create } from "../src"

describe("creating a database", () => {
    it("should create a database instance", () => {
        const db = create({});
        expect(db).toBeDefined();
    });

});
