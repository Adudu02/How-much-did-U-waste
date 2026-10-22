/**
 * Smoke del facade how-much-did-u-waste-core: el barrel expone la API pública
 * histórica (motor + adapters + wrappers) y la composición end-to-end funciona
 * —ingesta por raíces de un fixture Claude hasta getSummary— sin que este
 * paquete contenga código propio.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  // rutas de estado + setup
  setDataDir,
  dataDir,
  ensureUserData,
  packagedPricingPath,
  // modelo + contratos
  type IngestAdapter,
  type SyncAdapter,
  type UsageEvent,
  type ParsedLine,
  // adapters del pack
  ClaudeCodeAdapter,
  CodexAdapter,
  getIngestAdapters,
  getSyncAdapters,
  rootsFromConfig,
  // wrapper histórico
  ingestAll,
  // persistencia + pricing + vistas
  openDb,
  defaultDbPath,
  loadPricing,
  getSummary,
  // quota (framework + pack)
  ALL_PROBERS,
  runQuotaProbers,
  refreshQuota,
  // config store genérico
  createConfigStore,
} from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));

let tmp: string;

beforeAll(() => {
  // data dir temporal con pricing sembrado (mismo flujo que la app real).
  tmp = mkdtempSync(join(tmpdir(), "core-facade-"));
  setDataDir(tmp);
  ensureUserData();
});
beforeEach(() => {
  mkdirSync(join(tmp, "proj"), { recursive: true });
  copyFileSync(join(here, "fixtures", "deterministic.jsonl"), join(tmp, "proj", "s1.jsonl"));
});
afterEach(() => {
  rmSync(join(tmp, "proj"), { recursive: true, force: true });
  rmSync(join(tmp, "motor.db"), { force: true });
});

describe("barrel del facade — API pública histórica", () => {
  it("expone motor + adapters + wrappers", async () => {
    expect(typeof setDataDir).toBe("function");
    expect(typeof dataDir).toBe("function");
    expect(typeof ensureUserData).toBe("function");
    expect(typeof packagedPricingPath).toBe("function");
    expect(typeof openDb).toBe("function");
    expect(typeof defaultDbPath).toBe("function");
    expect(typeof loadPricing).toBe("function");
    expect(typeof getSummary).toBe("function");
    expect(typeof ingestAll).toBe("function");
    expect(typeof getIngestAdapters).toBe("function");
    expect(typeof getSyncAdapters).toBe("function");
    expect(typeof rootsFromConfig).toBe("function");
    expect(typeof ClaudeCodeAdapter).toBe("function");
    expect(typeof CodexAdapter).toBe("function");
    expect(typeof runQuotaProbers).toBe("function");
    expect(typeof refreshQuota).toBe("function");
    expect(typeof createConfigStore).toBe("function");
    expect(Object.keys(ALL_PROBERS).sort()).toEqual([
      "claude",
      "codex",
      "copilot",
      "gemini",
      "openrouter",
      "zai",
    ]);
  });

  it("defaultDbPath apunta al data dir inyectado", () => {
    expect(defaultDbPath()).toBe(join(tmp, "motor.db"));
  });
});

describe("wrapper ingestAll (firma por raíces) — end-to-end", () => {
  it("ingiere fixture Claude y produce summary coherente", async () => {
    const db = openDb(join(tmp, "motor.db"));
    const pricing = await loadPricing();
    const summary = await ingestAll(db, { projectsRoot: tmp, pricing });
    // deterministic: opus d1 (triplicado->1), haiku d1, ghost d1, opus d2 = 4
    expect(summary.eventsInserted).toBe(4);
    expect(summary.unknownModels).toEqual(["claude-ghost-9"]);

    const s = getSummary(db, pricing);
    expect(s.activity.turns).toBe(4);
    expect(s.totalCostUsd).toBeGreaterThan(0);
    db.close();
  });

  it("registry del pack respeta el aislamiento de tests (sin raíces default)", async () => {
    // projectsRoot override => solo Claude, sin lecturas fuera del fixture.
    const adapters = getIngestAdapters({ claudeRoot: tmp });
    expect(adapters.map((a) => a.id)).toEqual(["claude-code"]);
    expect(getSyncAdapters({ claudeRoot: tmp })).toEqual([]);
  });
});
