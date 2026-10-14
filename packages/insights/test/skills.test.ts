import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, existsSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSkillUsages } from "how-much-did-u-waste-core";
import { openDb, type DB } from "how-much-did-u-waste-core";
import { ingestAll } from "how-much-did-u-waste-core";
import { discoverCatalog, getSkills, inferPurpose, uninstallSkill, type CatalogEntry } from "../src/skills.js";
import { loadConfig, saveConfig, DEFAULT_CONFIG, type Config } from "../src/config.js";

const here = dirname(fileURLToPath(import.meta.url));
const fx = (name: string) => join(here, "fixtures", name);

describe("parseSkillUsages", () => {
  const usages = parseSkillUsages(readFileSync(fx("skills.jsonl"), "utf8"));

  it("detecta command-name en eventos user (con y sin command-args)", () => {
    const caveman = usages.filter((u) => u.skill === "caveman");
    expect(caveman).toHaveLength(2);
    expect(caveman[0].kind).toBe("command");
  });

  it("detecta comando nativo /model", () => {
    expect(usages.some((u) => u.skill === "model" && u.kind === "command")).toBe(true);
  });

  it("detecta Skill tool_use en assistant", () => {
    const fd = usages.find((u) => u.skill === "frontend-design");
    expect(fd?.kind).toBe("skill-tool");
  });
});

describe("ingest + getSkills", () => {
  let tmp: string;
  const catalog = new Map<string, CatalogEntry>([
    ["caveman", { name: "caveman", description: "modo caveman", category: "skill" }],
    ["other-skill", { name: "other-skill", description: "", category: "skill" }],
  ]);

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "motor-sk-"));
    const dir = join(tmp, "proj");
    mkdirSync(dir, { recursive: true });
    copyFileSync(fx("skills.jsonl"), join(dir, "sk.jsonl"));
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  async function seed(): Promise<DB> {
    const db = openDb(join(tmp, "motor.db"));
    // pricing default del repo
    const { loadPricing } = await import("how-much-did-u-waste-core");
    await ingestAll(db, { projectsRoot: tmp, pricing: await loadPricing() });
    return db;
  }

  it("skills_usage no se duplica en re-ingesta", async () => {
    const db = await seed();
    const before = (db.prepare("SELECT COUNT(*) AS n FROM skills_usage").get() as { n: number }).n;
    const { loadPricing } = await import("how-much-did-u-waste-core");
    await ingestAll(db, { projectsRoot: tmp, pricing: await loadPricing() });
    const after = (db.prepare("SELECT COUNT(*) AS n FROM skills_usage").get() as { n: number }).n;
    expect(after).toBe(before);
    expect(before).toBe(4); // caveman x2, model, frontend-design
    db.close();
  });

  it("agrega usos y calcula savedUsd = usos·min·tarifa/60", async () => {
    const db = await seed();
    const config: Config = { ...DEFAULT_CONFIG, hourlyRate: 120, minutesPerUseDefault: 5 };
    const { skills } = getSkills(db, config, catalog);
    const byName = Object.fromEntries(skills.map((s) => [s.name, s]));

    // caveman: 2 usos · 5 min · $120/h / 60 = $20
    expect(byName.caveman.uses).toBe(2);
    expect(byName.caveman.savedUsd).toBeCloseTo(20, 6);
    expect(byName.caveman.category).toBe("skill");
    expect(byName.caveman.inCatalog).toBe(true);

    // /model = builtin => categoria sistema
    expect(byName.model.category).toBe("sistema");
    // frontend-design (Skill tool_use) no esta en el catalogo de prueba => otro
    expect(byName["frontend-design"].category).toBe("otro");
    // skill del catalogo sin uso aparece en gris (uses 0)
    expect(byName["other-skill"].uses).toBe(0);
    expect(byName["other-skill"].savedUsd).toBe(0);
    db.close();
  });

  it("tarifa/hora 0 => ahorro 0 (como capturas)", async () => {
    const db = await seed();
    const { skills } = getSkills(db, { ...DEFAULT_CONFIG, minutesPerUseDefault: 30 }, catalog);
    expect(skills.every((s) => s.savedUsd === 0)).toBe(true);
    db.close();
  });
});

describe("config round-trip", () => {  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "motor-cfg-"));
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("saveConfig hace merge y loadConfig lo recupera", async () => {
    const path = join(tmp, "config.json");
    const saved = await saveConfig({ hourlyRate: 90, minutesPerUse: { caveman: 8 } }, path);
    expect(saved.hourlyRate).toBe(90);
    expect(saved.staleDays).toBe(DEFAULT_CONFIG.staleDays); // default preservado
    const loaded = await loadConfig(path);
    expect(loaded.hourlyRate).toBe(90);
    expect(loaded.minutesPerUse.caveman).toBe(8);
  });

  it("loadConfig sin archivo => defaults sin lanzar", async () => {
    const loaded = await loadConfig(join(tmp, "no-existe.json"));
    expect(loaded).toEqual(DEFAULT_CONFIG);
  });

  it("una config antigua sin waste lo agrega al guardarla", async () => {
    const path = join(tmp, "config.json");
    writeFileSync(path, `${JSON.stringify({ hourlyRate: 90 })}\n`);
    expect((await loadConfig(path)).waste).toEqual(DEFAULT_CONFIG.waste);
    await saveConfig({ staleDays: 7 }, path);
    expect(JSON.parse(readFileSync(path, "utf8")).waste).toEqual(DEFAULT_CONFIG.waste);
  });

  it("skillMeta: round-trip, merge y validación", async () => {
    const path = join(tmp, "config.json");
    const saved = await saveConfig({ skillMeta: { caveman: { tag: "docs", hidden: true }, otro: { pinned: true } } }, path);
    expect(saved.skillMeta.caveman).toEqual({ tag: "docs", hidden: true });
    const loaded = await loadConfig(path);
    expect(loaded.skillMeta.otro).toEqual({ pinned: true });
    await saveConfig({ skillMeta: { caveman: { hidden: false } } }, path); // reemplazo por entrada
    expect((await loadConfig(path)).skillMeta.caveman).toEqual({ hidden: false });
    expect((await loadConfig(path)).skillMeta.otro).toEqual({ pinned: true }); // el resto intacto
    await expect(saveConfig({ skillMeta: { x: { tag: 5 } } }, join(tmp, "c2.json"))).rejects.toThrow("tag");
    await expect(saveConfig({ skillMeta: { x: { sorpresa: true } } }, join(tmp, "c3.json"))).rejects.toThrow("skillMeta");
  });
});

describe("parseSkillUsages — sin falsos positivos", () => {
  it("un tool_result con <command-name> dentro (contenido de archivo) NO cuenta como uso", () => {
    const raw = readFileSync(join(here, "fixtures", "skill-falsepositive.jsonl"), "utf8");
    const usos = parseSkillUsages(raw);
    expect(usos.map((u) => u.skill)).toEqual(["deploy"]); // solo el comando real
    expect(usos.some((u) => u.skill === "x")).toBe(false); // el del README, no
  });

  it("mencionar /skill en prosa no cuenta como uso", () => {
    const raw = readFileSync(join(here, "fixtures", "skill-falsepositive.jsonl"), "utf8");
    expect(parseSkillUsages(raw).some((u) => u.skill === "ponytail")).toBe(false);
  });
});

describe("discoverCatalog", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "motor-catalog-"));
    const skill = join(tmp, "codex", "skills", "nested", "ponytail");
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(skill, "SKILL.md"), "---\nname: ponytail\ndescription: minimalismo\n---\n");
    const imported = join(tmp, "codex", "skills", "vendor_imports", "skip");
    mkdirSync(imported, { recursive: true });
    writeFileSync(join(imported, "SKILL.md"), "---\nname: no-debe-aparecer\n---\n");
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("descubre skills Codex recursivos y marca disponibilidad", async () => {
    const catalog = await discoverCatalog({
      claudeRoot: join(tmp, "claude"),
      codexRoot: join(tmp, "codex"),
      qwenRoot: join(tmp, "qwen"),
      agentsRoot: join(tmp, "agents"),
    });
    expect(catalog.get("ponytail")?.agents).toEqual(["codex"]);
    expect(catalog.has("no-debe-aparecer")).toBe(false);
  });

  it("sigue symlinks, escanea ~/.agents y ~/.qwen, y baja al bucket synced", async () => {
    // Skill compartido instalado en ~/.agents y enlazado desde cada agente
    // (el layout real de los instaladores cross-agent).
    const shared = join(tmp, "agents", "skills", "shared");
    mkdirSync(shared, { recursive: true });
    writeFileSync(join(shared, "SKILL.md"), "---\nname: shared\ndescription: compartido\n---\n");
    for (const [dir, rel] of [
      ["claude/skills", "../../agents/skills/shared"],
      ["qwen/skills", "../../agents/skills/shared"],
      ["codex/skills", "../../agents/skills/shared"],
    ] as const) {
      mkdirSync(join(tmp, dir), { recursive: true });
      symlinkSync(rel, join(tmp, dir, "shared"));
    }
    // Bucket synced de Claude (skills/synced/<id>/x/SKILL.md) + .system oculto.
    const synced = join(tmp, "claude", "skills", "synced", "bucket", "synced-skill");
    mkdirSync(synced, { recursive: true });
    writeFileSync(join(synced, "SKILL.md"), "---\nname: synced-skill\ndescription: remoto\n---\n");
    const hidden = join(tmp, "codex", "skills", ".system", "hidden");
    mkdirSync(hidden, { recursive: true });
    writeFileSync(join(hidden, "SKILL.md"), "---\nname: oculto\n---\n");

    const catalog = await discoverCatalog({
      claudeRoot: join(tmp, "claude"),
      codexRoot: join(tmp, "codex"),
      qwenRoot: join(tmp, "qwen"),
      agentsRoot: join(tmp, "agents"),
    });
    expect(catalog.get("shared")?.agents).toEqual(["agents", "claude-code", "codex", "qwen"]);
    expect(catalog.get("synced-skill")?.agents).toEqual(["claude-code"]);
    expect(catalog.has("oculto")).toBe(false);

    // Rutas de instalación: lógica vs realpath (symlink) y dir real.
    const sharedEntry = catalog.get("shared");
    expect(sharedEntry?.installedAt).toHaveLength(4);
    const claudeInstall = sharedEntry?.installedAt?.find((l) => l.agent === "claude-code");
    expect(claudeInstall?.path).toBe(join(tmp, "claude", "skills", "shared"));
    expect(claudeInstall?.target).toBe(join(tmp, "agents", "skills", "shared"));
    const agentsInstall = sharedEntry?.installedAt?.find((l) => l.agent === "agents");
    expect(agentsInstall?.target).toBe(agentsInstall?.path); // dir real: target = path
  });

  it("registra el propósito declarado en el frontmatter", async () => {
    const tagged = join(tmp, "claude", "skills", "tagged");
    mkdirSync(tagged, { recursive: true });
    writeFileSync(join(tagged, "SKILL.md"), "---\nname: tagged\ndescription: x\npurpose: docs\n---\n");
    const catalog = await discoverCatalog({
      claudeRoot: join(tmp, "claude"),
      codexRoot: join(tmp, "codex"),
      qwenRoot: join(tmp, "qwen"),
      agentsRoot: join(tmp, "agents"),
    });
    expect(catalog.get("tagged")?.purpose).toBe("docs");
  });
});

describe("inferPurpose", () => {
  it("clasifica por palabras clave del nombre y la descripción", () => {
    expect(inferPurpose("typescript-pro", "Analyze TypeScript and JavaScript code, type systems and modules")).toBe("code");
    expect(inferPurpose("devops-helper", "Diagnose deployment, Docker and pipeline failures with sanitized logs")).toBe("devops");
    expect(inferPurpose("morning", "Your morning brief, agenda and schedule summary")).toBe("productivity");
    expect(inferPurpose("auditor", "Security audit of authentication and secrets handling")).toBe("security");
    expect(inferPurpose("x", "")).toBe("other");
  });
});

describe("getSkills — propósito, ocultar y fijar", () => {
  let tmp: string;
  let db: DB;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "motor-purpose-"));
    db = openDb(join(tmp, "motor.db"));
  });
  afterEach(() => {
    db.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("manual > frontmatter > heurística, y hidden/pinned se reflejan", () => {
    const catalog = new Map<string, CatalogEntry>([
      ["deployer", { name: "deployer", description: "Deploy docker pipelines", category: "skill" }],
      ["guard", { name: "guard", description: "x", category: "skill", purpose: "security" }],
      ["solo-uso", { name: "solo-uso", description: "", category: "skill" }],
    ]);
    const config: Config = {
      ...DEFAULT_CONFIG,
      skillMeta: {
        deployer: { tag: "docs" },
        "solo-uso": { hidden: true, pinned: true },
      },
    };
    const { skills } = getSkills(db, config, catalog);
    const byName = Object.fromEntries(skills.map((s) => [s.name, s]));
    expect(byName.deployer.purpose).toBe("docs");
    expect(byName.deployer.purposeSource).toBe("manual");
    expect(byName.guard.purpose).toBe("security");
    expect(byName.guard.purposeSource).toBe("frontmatter");
    expect(byName["solo-uso"].hidden).toBe(true);
    expect(byName["solo-uso"].pinned).toBe(true);
    // Fijados primero.
    expect(skills[0].name).toBe("solo-uso");
    // Sin tag manual ni frontmatter => heurística sobre la descripción.
    const config2: Config = { ...DEFAULT_CONFIG };
    const { skills: skills2 } = getSkills(db, config2, catalog);
    expect(skills2.find((s) => s.name === "deployer")?.purpose).toBe("devops");
    expect(skills2.find((s) => s.name === "deployer")?.purposeSource).toBe("heuristic");
  });
});

describe("uninstallSkill", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "motor-uninstall-"));
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("desenlaza symlinks, manda dirs reales a la papelera y reusa lo demás", async () => {
    const real = join(tmp, "agents", "skills", "demo");
    mkdirSync(real, { recursive: true });
    writeFileSync(join(real, "SKILL.md"), "---\nname: demo\n---\n");
    mkdirSync(join(tmp, "claude", "skills"), { recursive: true });
    symlinkSync("../../agents/skills/demo", join(tmp, "claude", "skills", "demo"));
    const outside = join(tmp, "elsewhere", "demo");
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "SKILL.md"), "---\nname: demo\n---\n");

    const report = await uninstallSkill(
      "demo",
      [
        { agent: "claude-code", path: join(tmp, "claude", "skills", "demo"), target: real },
        { agent: "agents", path: real, target: real },
        { agent: "?", path: outside, target: outside },
        { agent: "?", path: join(tmp, "claude", "skills", "fantasma"), target: "" },
        { agent: "?", path: join(tmp, "agents", "skills"), target: "" }, // la raíz misma: prohibida
      ],
      { claudeRoot: join(tmp, "claude"), codexRoot: join(tmp, "codex"), qwenRoot: join(tmp, "qwen"), agentsRoot: join(tmp, "agents") },
      join(tmp, "trash"),
    );

    expect(report.removed).toEqual([join(tmp, "claude", "skills", "demo")]);
    expect(report.trashed).toHaveLength(1);
    expect(existsSync(join(tmp, "claude", "skills", "demo"))).toBe(false); // symlink fuera
    expect(existsSync(real)).toBe(false); // dir real movido
    expect(report.trashed[0].to.startsWith(join(tmp, "trash", "demo-"))).toBe(true);
    expect(existsSync(join(report.trashed[0].to, "SKILL.md"))).toBe(true); // recuperable
    expect(existsSync(outside)).toBe(true); // fuera de raíces: intacto
    expect(report.skipped.map((s) => s.reason)).toContain("fuera de las raíces de skills");
    expect(report.skipped.map((s) => s.reason)).toContain("no existe");
  });
});
