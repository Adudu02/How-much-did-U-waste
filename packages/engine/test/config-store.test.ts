/**
 * Config store genérico: schema-driven (defaults + validate + merge),
 * carga con fallback a defaults y guardado atómico tmp+rename.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConfigStore, type ConfigStoreSchema } from "../src/lib/config-store.js";

interface TestConfig {
  hourlyRate: number;
  tags: Record<string, string>;
}

const schema: ConfigStoreSchema<TestConfig> = {
  defaults: { hourlyRate: 0, tags: {} },
  validate(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("config inválida");
    const allowed = new Set(["hourlyRate", "tags"]);
    for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`config inválida: clave desconocida '${key}'`);
    if ((value as TestConfig).hourlyRate !== undefined && typeof (value as TestConfig).hourlyRate !== "number") throw new Error("config inválida: hourlyRate");
    return value as Partial<TestConfig>;
  },
  merge(base, partial) {
    return { ...base, ...partial, tags: { ...base.tags, ...(partial.tags ?? {}) } };
  },
};

let tmp: string;
let path: string;
const store = createConfigStore(schema);

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "config-store-"));
  path = join(tmp, "config.json");
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe("load", () => {
  it("archivo ausente => defaults, sin lanzar", async () => {
    const config = await store.load(path);
    expect(config).toEqual({ hourlyRate: 0, tags: {} });
  });
  it("archivo válido => merge sobre defaults", async () => {
    writeFileSync(path, JSON.stringify({ hourlyRate: 50 }), "utf8");
    const config = await store.load(path);
    expect(config.hourlyRate).toBe(50);
    expect(config.tags).toEqual({});
  });
  it("archivo con clave desconocida => defaults (no se acepta silenciosamente)", async () => {
    writeFileSync(path, JSON.stringify({ sorpresa: 1 }), "utf8");
    const config = await store.load(path);
    expect(config).toEqual(schema.defaults);
  });
});

describe("save", () => {
  it("update parcial se mergea y persiste", async () => {
    await store.save({ hourlyRate: 10 }, path);
    await store.save({ tags: { a: "x" } }, path);
    const onDisk = JSON.parse(readFileSync(path, "utf8"));
    expect(onDisk).toEqual({ hourlyRate: 10, tags: { a: "x" } });
  });
  it("clave desconocida => rechaza y NO toca el archivo", async () => {
    await store.save({ hourlyRate: 1 }, path);
    const before = readFileSync(path, "utf8");
    await expect(store.save({ hack: 1 }, path)).rejects.toThrow(/desconocida/);
    expect(readFileSync(path, "utf8")).toBe(before);
  });
  it("guardado atómico: no queda archivo .tmp y el contenido es válido", async () => {
    await store.save({ hourlyRate: 7 }, path);
    expect(existsSync(`${path}.tmp`)).toBe(false);
    expect(JSON.parse(readFileSync(path, "utf8")).hourlyRate).toBe(7);
  });
});
