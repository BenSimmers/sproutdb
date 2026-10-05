import { defineConfig } from "tsup";
import fs from "fs";

export default defineConfig({
  format: ["cjs", "esm"],
  entry: ["./src/index.ts", "./src/server.ts", "./src/node.ts", "./src/cli.ts"],
  dts: true,
  shims: true,
  skipNodeModulesBundle: true,
  clean: true,
  // The server serves the dashboard's static files from next to its own module at runtime.
  onSuccess: async () => {
    fs.cpSync("src/dashboard", "dist/dashboard", { recursive: true });
  },
});