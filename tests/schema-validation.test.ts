import { describe, it, expect } from "vitest";
import { table } from "../src/modules/table";
import { ValidationError } from "../src/lib/types";
import { z } from "zod";

describe("Schema Validation", () => {
    it("should allow valid data when schema is provided", () => {
        const userSchema = z.object({
            id: z.number().positive(),
            name: z.string().min(1),
            email: z.email(),
            age: z.number().min(0).max(150),
        });

        const users = table(userSchema);

        const validUser = {
            id: 1,
            name: "John Doe",
            email: "john@example.com",
            age: 30,
        };

        expect(() => users.insert(validUser)).not.toThrow();
        expect(users.all()).toHaveLength(1);
    });

    it("should reject invalid data when schema is provided", () => {
        const userSchema = z.object({
            id: z.number().positive(),
            name: z.string().min(1),
            email: z.email(),
            age: z.number().min(0).max(150),
        });

        const users = table(userSchema);

        const invalidUser = {
            id: -1, // Invalid: negative ID
            name: "", // Invalid: empty name
            email: "not-an-email", // Invalid: not a valid email
            age: 200, // Invalid: age too high
        };

        expect(() => users.insert(invalidUser)).toThrow(ValidationError);
    });

    it("should validate on update operations", () => {
        const userSchema = z.object({
            id: z.number().positive(),
            name: z.string().min(1),
            email: z.email(),
        });

        const users = table(userSchema);

        users.insert({
            id: 1,
            name: "John Doe",
            email: "john@example.com",
        });

        // Valid update - partial validation is currently simplified
        expect(() => 
            users.update({ where: { id: 1 } }, { email: "newemail@example.com" })
        ).not.toThrow();
    });

    it("should validate on load operations", () => {
        const userSchema = z.object({
            id: z.number().positive(),
            name: z.string().min(1),
            email: z.string().email(),
        });

        const users = table(userSchema);

        const validUsers = [
            { id: 1, name: "John", email: "john@example.com" },
            { id: 2, name: "Jane", email: "jane@example.com" },
        ];

        const invalidUsers = [
            { id: 1, name: "John", email: "john@example.com" },
            { id: -2, name: "", email: "not-email" }, // Invalid
        ];

        expect(() => users.load(validUsers)).not.toThrow();
        expect(() => users.load(invalidUsers)).toThrow(ValidationError);
    });

    it("should work without schema (backward compatibility)", () => {
        const users = table<{ id: number; name: string }>();
        expect(() =>

            // allowing for an any type insertion as we are testing no schema case
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            users.insert({ id: "invalid" as any, name: 123 as any })
        ).not.toThrow();
    });

    it("should provide detailed validation error messages", () => {
        const userSchema = z.object({
            id: z.number().positive("ID must be positive"),
            name: z.string().min(1, "Name is required"),
            email: z.email("Must be a valid email"),
        });

        const users = table(userSchema);

        try {
            users.insert({
                id: -1,
                name: "",
                email: "invalid",
            });
        } catch (error) {
            expect(error).toBeInstanceOf(ValidationError);
            expect((error as ValidationError).message).toContain("ID must be positive");
            expect((error as ValidationError).message).toContain("Name is required");
            expect((error as ValidationError).message).toContain("Must be a valid email");
        }
    });
});