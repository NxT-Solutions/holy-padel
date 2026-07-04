import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    // Mirror the tsconfig `@/*` -> ./src/* alias so tests can import app modules.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
