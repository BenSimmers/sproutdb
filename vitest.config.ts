import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true, // Enable global test functions like `describe` and `it`
    coverage: {
      provider: "v8", // Use v8 for coverage
      reporter: ["text", "html"], // Generate text and HTML coverage reports
    },
  },
});