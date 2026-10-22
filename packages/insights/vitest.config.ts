import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Alias a sources: los tests corren sin build previo (igual que el root).
const core = fileURLToPath(new URL("../core/src/index.ts", import.meta.url));
const engine = fileURLToPath(new URL("../engine/src/index.ts", import.meta.url));
const adapters = fileURLToPath(new URL("../adapters/src/index.ts", import.meta.url));

// Cobertura de la capa de dominio (insights). Umbrales = baseline medido.
export default defineConfig({
  resolve: {
    alias: {
      "how-much-did-u-waste-core": core,
      "agent-usage-engine": engine,
      "agent-usage-adapters": adapters,
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
      },
    },
  },
});
