import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Alias a source de engine/adapters: los tests del facade corren sin build
// previo (mismo patrón que insights/root).
const engine = fileURLToPath(new URL("../engine/src/index.ts", import.meta.url));
const adapters = fileURLToPath(new URL("../adapters/src/index.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "agent-usage-engine": engine,
      "agent-usage-adapters": adapters,
    },
  },
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
