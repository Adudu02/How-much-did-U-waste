/**
 * Probers integrados del pack (parsers por proveedor + sanitización de
 * credenciales). La maquinaria (caché TTL, runner aislado) se prueba en el
 * motor; aquí solo lo específico de cada proveedor. Todo sin red.
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { QuotaSnapshot } from "agent-usage-engine";
import { parseClaudeUsage } from "../src/quota/probers/claude.js";
import { mapCodexWindow, parseCodexUsage } from "../src/quota/probers/codex.js";
import { mapZaiWindow, parseZaiUsage } from "../src/quota/probers/zai.js";
import { parseGeminiQuota } from "../src/quota/probers/gemini.js";
import { parseCopilotUser } from "../src/quota/probers/copilot.js";
import { parseOpenRouterKey } from "../src/quota/probers/openrouter.js";

const NOW = new Date("2026-09-13T12:00:00Z");

describe("parseClaudeUsage — tolerante a buckets planos y limits[]", () => {
  it("forma plana: five_hour/seven_day/opus/sonnet", () => {
    const snaps = parseClaudeUsage(
      {
        five_hour: { utilization: 23, resets_at: "2026-09-13T15:00:00Z" },
        seven_day: { utilization: 60, resets_at: "2026-09-18T00:00:00Z" },
        seven_day_opus: { utilization: 81, resets_at: "2026-09-18T00:00:00Z" },
        seven_day_sonnet: { utilization: 40, resets_at: "2026-09-18T00:00:00Z" },
      },
      NOW,
    );
    expect(snaps).toHaveLength(4);
    expect(snaps[0]).toMatchObject({ provider: "claude", window: "five_hour", usedPercent: 23 });
    expect(snaps[2]).toMatchObject({ window: "weekly", model: "claude-opus", usedPercent: 81 });
    expect(snaps[3]).toMatchObject({ window: "weekly", model: "claude-sonnet", usedPercent: 40 });
  });
  it("forma limits[]: session/weekly_all/weekly_scoped con scope.model", () => {
    const snaps = parseClaudeUsage(
      {
        limits: [
          { kind: "session", utilization: 10, resets_at: "2026-09-13T15:00:00Z" },
          { kind: "weekly_all", utilization: 55 },
          { kind: "weekly_scoped", utilization: 77, scope: { model: "claude-opus" } },
        ],
      },
      NOW,
    );
    expect(snaps).toHaveLength(3);
    expect(snaps[2]).toMatchObject({ window: "weekly", model: "claude-opus", usedPercent: 77 });
  });
  it("sin formas reconocidas => vacío (nunca inventa)", () => {
    expect(parseClaudeUsage({ otra_cosa: 1 }, NOW)).toEqual([]);
  });
});

describe("parseCodexUsage + mapa de ventanas", () => {
  it("mapea primary/secondary (plan_type incluido)", () => {
    const snaps = parseCodexUsage(
      {
        plan_type: "plus",
        rate_limit: {
          primary_window: { used_percent: 40, limit_window_minutes: 300, reset_at: "2026-09-13T15:00:00Z" },
          secondary_window: { used_percent: 10, limit_window_minutes: 10080 },
        },
      },
      NOW,
    );
    expect(snaps).toHaveLength(2);
    expect(snaps[0]).toMatchObject({ window: "five_hour", usedPercent: 40, plan: "plus" });
    expect(snaps[1]).toMatchObject({ window: "weekly", usedPercent: 10 });
  });
  it("reset_after_seconds se convierte a ISO", () => {
    const snaps = parseCodexUsage({ rate_limit: { primary_window: { used_percent: 1, limit_window_seconds: 300, reset_after_seconds: 3600 } } }, NOW);
    expect(snaps[0].resetsAt).toBe("2026-09-13T13:00:00.000Z");
  });
  it("mapCodexWindow: 300 → five_hour, 10080 → weekly", () => {
    expect(mapCodexWindow(300)).toBe("five_hour");
    expect(mapCodexWindow(10080)).toBe("weekly");
    expect(mapCodexWindow(4320)).toBe("window-4320");
  });
});

describe("parseZaiUsage — forma A (limits) y forma B (total_usage)", () => {
  it("forma A: mapea unit 3/6 a five_hour/weekly", () => {
    const snaps = parseZaiUsage(
      { data: { limits: [
        { type: "CREDIT_LIMIT", percentage: 12, unit: 3, number: 5, nextResetTime: 1787619857000 },
        { type: "CREDIT_LIMIT", percentage: 80, unit: 6, number: 1, nextResetTime: 1790000000000 },
      ] } },
      NOW,
    );
    expect(snaps).toHaveLength(2);
    expect(snaps[0]).toMatchObject({ window: "five_hour", usedPercent: 12 });
    expect(snaps[1]).toMatchObject({ window: "weekly", usedPercent: 80 });
  });
  it("forma B: total_usage con porcentaje calculado", () => {
    const snaps = parseZaiUsage({ data: { total_usage: { used: 30, limit: 100, remaining: 70 } } }, NOW);
    expect(snaps).toHaveLength(1);
    expect(snaps[0]).toMatchObject({ window: "monthly", usedPercent: 30, limit: 100, remaining: 70 });
  });
  it("mapZaiWindow: unidades 4/5", () => {
    expect(mapZaiWindow(4, 3)).toBe("3d");
    expect(mapZaiWindow(5, 1)).toBe("monthly");
  });
});

describe("sanitización — credenciales fuera de resultados", () => {
  it("ni el token ni los headers aparecen en los snapshots", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "motor-san-"));
    const SECRET = "sk-ant-SECRET-TOKEN-123";
    writeFileSync(join(tmp, "creds.json"), JSON.stringify({ claudeAiOauth: { accessToken: SECRET } }));
    const { probeClaude } = await import("../src/quota/probers/claude.js");
    const snaps = await probeClaude({
      fetchImpl: (async () => ({ ok: true, json: async () => ({ five_hour: { utilization: 5 } }) })) as unknown as typeof fetch,
      now: () => NOW,
      timeoutMs: 1000,
      claudeCredentialsPath: join(tmp, "creds.json"),
    });
    const serialized = JSON.stringify(snaps);
    expect(serialized).not.toContain(SECRET);
    rmSync(tmp, { recursive: true, force: true });
  });
});

// ── Fase 2: Gemini, Copilot, OpenRouter (fixture-driven) ────────────────────

describe("parseGeminiQuota — buckets por modelId, sin agregación", () => {
  it("un snapshot por modelId con usedPercent derivado de la fracción", () => {
    const snaps = parseGeminiQuota(
      {
        buckets: [
          { modelId: "gemini-3-pro", remainingAmount: 800, remainingFraction: 0.8, resetTime: "2026-09-20T00:00:00Z" },
          { modelId: "gemini-3-flash", remainingAmount: 50, remainingFraction: 0.25 },
        ],
      },
      NOW,
    );
    expect(snaps).toHaveLength(2);
    expect(snaps[0]).toMatchObject({ provider: "gemini", model: "gemini-3-pro", usedPercent: 20, limit: 1000, remaining: 800 });
    expect(snaps[1]).toMatchObject({ model: "gemini-3-flash", usedPercent: 75, limit: 200 });
  });
  it("fracción inválida o ausente => fila omitida", () => {
    expect(parseGeminiQuota({ buckets: [{ modelId: "x" }, { modelId: "y", remainingFraction: 0 }, { modelId: "z", remainingFraction: 1.5 }] }, NOW)).toEqual([]);
  });
});

describe("parseCopilotUser — percent_remaining es RESTANTE", () => {
  it("se invierte a usado; unlimited se omite; reset y plan compartidos", () => {
    const snaps = parseCopilotUser(
      {
        copilot_plan: "pro",
        quota_reset_date: "2026-10-01",
        quota_snapshots: {
          chat: { percent_remaining: 80, remaining: null, unlimited: false },
          premium_interactions: { percent_remaining: 5, remaining: 2, unlimited: false },
          completions: { unlimited: true },
        },
      },
      NOW,
    );
    expect(snaps).toHaveLength(2); // unlimited fuera
    expect(snaps[0]).toMatchObject({ model: "chat", usedPercent: 20, window: "monthly", plan: "pro", resetsAt: "2026-10-01" });
    expect(snaps[1]).toMatchObject({ model: "premium_interactions", usedPercent: 95, remaining: 2 });
  });
});

describe("parseOpenRouterKey — crédito key-level", () => {
  it("porcentaje de crédito usado con tope 100", () => {
    const snaps = parseOpenRouterKey({ data: { usage: 3, limit: 10, limit_remaining: 7, is_free_tier: false } }, NOW);
    expect(snaps).toHaveLength(1);
    expect(snaps[0]).toMatchObject({ provider: "openrouter", window: "credit", usedPercent: 30, limit: 10, remaining: 7 });
    expect(parseOpenRouterKey({ data: { usage: 99, limit: 10 } }, NOW)[0].usedPercent).toBe(100);
  });
  it("limit ausente/0 => vacío", () => {
    expect(parseOpenRouterKey({ data: { usage: 1 } }, NOW)).toEqual([]);
    expect(parseOpenRouterKey({ data: { usage: 1, limit: 0 } }, NOW)).toEqual([]);
  });
});
