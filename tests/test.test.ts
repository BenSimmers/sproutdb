import { describe, it, expect } from "vitest";
import { print } from "../src/modules/hello";

describe("hello", () => {
    it("should return 'Hello, World!'", () => {
        const result = print();
        expect(result).toBe("Hello, World!");

    });
});
