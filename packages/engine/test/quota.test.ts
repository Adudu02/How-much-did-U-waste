/**
 * Quota framework del motor: caché con TTL + runner de probers inyectable.
 * Los probers concretos (parsers por proveedor) viven en el pack de adapters;
 * aquí se prueba la maquinaria con probers fake, sin red.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cacheFreshness, mergeCache, readQuotaCache, writeQuotaCache } from "../src/quota/cache.js";
import { runQuotaProbers, type QuotaProbers } from "../src/quota/probers.js";
import type { QuotaSnapshot } from "../src/quota/types.js";

const NOW = new Date("2026-09-13T12:00:00Z");

describe("caché — round-trip, TTL y merge por proveedor", () => {
  let tmp: string;
  let path: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "motor-quota-"));
    path = join(tmp, "quota-cache.json");
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  const snap: QuotaSnapshot = { provider: "claude", window: "five_hour", usedPercent: 10, fetchedAt: NOW.toISOString(), origin: "live" };

  it("write → read → freshness según TTL", () => {
    writeQuotaCache(NOW.toISOString(), [snap], path);
    const cache = readQuotaCache(path)!;
    expect(cache.snapshots).toHaveLength(1);
    expect(cacheFreshness(cache, 5, Date.parse("2026-09-13T12:03:00Z")).fresh).toBe(true);
    expect(cacheFreshness(cache, 5, Date.parse("2026-09-13T12:10:00Z")).fresh).toBe(false);
  });
  it("merge reemplaza por proveedor y preserva el resto", () => {
    const cache = { version: 1 as const, fetchedAt: NOW.toISOString(), snapshots: [
      snap,
      { provider: "codex", window: "five_hour", usedPercent: 20, fetchedAt: NOW.toISOString(), origin: "offline-stale" as const },
    ] };
    const merged = mergeCache(cache, "2026-09-13T13:00:00Z", [{ provider: "claude", snapshots: [{ ...snap, usedPercent: 50 }] }]);
    expect(merged.snapshots).toHaveLength(2);
    expect(merged.snapshots.find((s) => s.provider === "claude")?.usedPercent).toBe(50);
    expect(merged.snapshots.find((s) => s.provider === "codex")?.usedPercent).toBe(20);
  });
  it("caché corrupta/ausente => null", () => {
    expect(readQuotaCache(join(tmp, "no-existe.json"))).toBeNull();
  });
});

describe("runQuotaProbers — paralelo, aislado, estados", () => {
  const ctx = { claudeCredentialsPath: "/no/existe", codexRoot: "/no/existe" };
  const probers: QuotaProbers = {
    ok: async () => [{ provider: "ok", window: "five_hour", usedPercent: 1, fetchedAt: NOW.toISOString(), origin: "live" }],
    boom: async () => {
      throw new Error("HTTP 500 en endpoint");
    },
  };

  it("fallo individual no afecta al resto; habilitado por default", async () => {
    const results = await runQuotaProbers(probers, {}, ctx, { fetchImpl: (async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch, now: () => NOW });
    const ok = results.find((r) => r.provider === "ok")!;
    const boom = results.find((r) => r.provider === "boom")!;
    expect(ok.status).toBe("live");
    expect(ok.snapshots).toHaveLength(1);
    expect(boom.status).toBe("error");
    expect(boom.error).toMatch(/HTTP 500/);
  });
  it("disabled no ejecuta el prober", async () => {
    let called = 0;
    const lazy: QuotaProbers = { lazy: async () => { called++; return []; } };
    const results = await runQuotaProbers(lazy, { lazy: false }, ctx, { fetchImpl: (async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch, now: () => NOW });
    expect(results[0]).toMatchObject({ provider: "lazy", status: "disabled" });
    expect(called).toBe(0);
  });
  it("no-credential por convención de mensaje", async () => {
    const nc: QuotaProbers = { zai: async () => { throw new Error("no-credential: falta la key"); } };
    const results = await runQuotaProbers(nc, {}, ctx, { fetchImpl: (async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch, now: () => NOW });
    expect(results[0].status).toBe("no-credential");
  });
  it("registry vacío => sin resultados (el motor no trae probers)", async () => {
    const results = await runQuotaProbers({}, {}, ctx, { now: () => NOW });
    expect(results).toEqual([]);
  });
});
