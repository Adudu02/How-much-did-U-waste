import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Alias al source del motor: los tests del pack corren sin build previo
// (mismo patrón que insights/root).
const engine = fileURLToPath(new URL("../engine/src/index.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "agent-usage-engine": engine },
  },
  test: {
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      thresholds: {
        lines: 85,
        functions: 85,
      },
    },
  },
});
