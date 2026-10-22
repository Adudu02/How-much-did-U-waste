import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests del motor genérico. Sin alias externos: el motor no depende de nadie
// más allá de better-sqlite3.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["**/dist/**", "**/*.d.ts"],
      thresholds: {
        lines: 85,
        functions: 85,
      },
    },
  },
});
