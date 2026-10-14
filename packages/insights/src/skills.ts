/**
 * Página Skills (PLAN §4.2). Cataloga los skills instalados de Claude Code,
 * Codex, Qwen y el compartido ~/.agents (RO), cuenta
 * usos desde skills_usage y calcula $ ahorrado = usos·min·tarifa/60. Sin tarifa
 * (o sin minutos) => $0, como en las capturas de referencia.
 */
import type { Dirent } from "node:fs";
import { cp, lstat, mkdir, realpath, rename, rm, stat, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { dataDir, readFileRO, readDirRO } from "how-much-did-u-waste-core";
import type { DB } from "how-much-did-u-waste-core";
import type { Config } from "./config.js";

export interface InstallLocation {
  agent: string;
  path: string; // ruta lógica dentro del catálogo del agente
  target: string; // realpath (distinto de path si es symlink)
}

export interface CatalogEntry {
  name: string;
  description: string;
  category: string;
  agents?: string[];
  installedAt?: InstallLocation[];
  purpose?: string; // desde frontmatter (purpose/category)
}

export interface SkillRow {
  name: string;
  uses: number;
  lastUsed: string | null;
  category: string; // catálogo | "sistema" (builtin) | "otro"
  savedUsd: number;
  minutesPerUse: number;
  inCatalog: boolean;
  availableTo: string[];
  description: string;
  purpose: string; // code | productivity | investigation | docs | devops | security | other | manual
  purposeSource: "manual" | "frontmatter" | "heuristic" | "none";
  installedAt: InstallLocation[]; // rutas de instalación (paths abreviados con ~)
  hidden: boolean;
  pinned: boolean;
  agents: { agent: string; uses: number; savedUsd: number }[];
}

// Propósitos canónicos para agrupar/ordenar skills.
export const PURPOSES = ["code", "productivity", "investigation", "docs", "devops", "security", "other"] as const;
const PURPOSE_SET = new Set<string>(PURPOSES);

// Heurística por palabras clave (EN+ES) sobre nombre+descripción. Orden =
// prioridad en empates: lo específico primero.
const PURPOSE_KEYWORDS: Record<string, string[]> = {
  security: ["security", "seguridad", "vulnerab", "xss", "csrf", "auth", "credential", "secreto", "secret", "threat", "sanitize", "sanitiza", "audit"],
  devops: ["deploy", "desplieg", "docker", "pipeline", "ci/cd", "bitbucket", "pm2", "kubernetes", "k8s", "infraestr", "infrastructure", "servidor", "server", "nginx", "release", "rollback", "entorno", "environment", "devops"],
  docs: ["documentación", "documentation", "readme", "adr", "glosario", "glossary", "spec", "especificación", "write-up", "docx", "pptx", "xlsx", "pdf", "slide", "presentación", "presentation", "docs", "document"],
  investigation: ["research", "investigaci", "evidence", "hipótesis", "hypothesis", "diagnos", "causa raíz", "root cause", "trace", "traza", "benchmark", "analyze", "analiza", "explore", "descubre", "discover", "investiga"],
  productivity: ["productiv", "workflow", "flujo de trabajo", "automatiz", "shortcut", "atajo", "plantilla", "template", "scaffold", "boilerplate", "checklist", "agenda", "schedule", "prompt", "handoff", "resumen", "summary", "recurrent", "hábito", "morning", "transcript", "compact"],
  code: ["code", "código", "codig", "refactor", "typescript", "javascript", "python", "api", "module", "módulo", "arquitectura", "architecture", "function", "función", "library", "framework", "test", "prueba", "tdd", "coverage", "bug", "debug", "compile", "type", "codebase"],
};

/** Clasifica un skill por propósito a partir de su nombre y descripción. */
export function inferPurpose(name: string, description: string): string {
  const hay = `${name} ${description}`.toLowerCase();
  let best = "other";
  let bestScore = 0;
  for (const [purpose, words] of Object.entries(PURPOSE_KEYWORDS)) {
    let score = 0;
    for (const w of words) if (hay.includes(w)) score++;
    if (score > bestScore) {
      best = purpose;
      bestScore = score;
    }
  }
  return best;
}

// Comandos nativos de Claude Code => categoría "sistema" (no cuentan como skills).
const BUILTIN = new Set([
  "model", "clear", "help", "init", "review", "compact", "config", "cost",
  "memory", "doctor", "status", "resume", "mcp", "agents", "permissions",
  "hooks", "login", "logout", "bug", "ide", "vim", "terminal-setup",
  "pr-comments", "release-notes", "add-dir", "plugin", "reload-plugins", "fast",
]);

function frontmatter(raw: string): Record<string, string> {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

/** Recorre los catálogos instalados (RO): ~/.claude, ~/.codex, ~/.qwen y el
 *  compartido ~/.agents (convención cross-agent). Los instaladores suelen
 *  enlazar (symlink) skills compartidos en lugar de copiarlos, así que el
 *  escaneo resuelve symlinks y busca SKILL.md en profundidad. */
export async function discoverCatalog(
  roots: { claudeRoot?: string; codexRoot?: string; qwenRoot?: string; agentsRoot?: string } = {},
): Promise<Map<string, CatalogEntry>> {
  const catalog = new Map<string, CatalogEntry>();
  const add = (
    name: string,
    description: string,
    category: string,
    agent: string,
    install?: InstallLocation,
    purpose?: string,
  ) => {
    const current = catalog.get(name);
    // Registra la ruta de instalación (dedupe por agente+ruta).
    const installedAt = install
      ? [...(current?.installedAt ?? []).filter((l) => !(l.agent === install.agent && l.path === install.path)), install]
      : (current?.installedAt ?? []);
    installedAt.sort((a, b) => a.agent.localeCompare(b.agent) || a.path.localeCompare(b.path));
    catalog.set(name, {
      name,
      description: current?.description || description,
      category: current?.category || category,
      agents: [...new Set([...(current?.agents ?? []), agent])].sort(),
      installedAt,
      purpose: current?.purpose || purpose,
    });
  };
  const readSkill = async (file: string, fallback: string, category: string, agent: string) => {
    let raw: string;
    try {
      raw = await readFileRO(file);
    } catch {
      return;
    }
    const fm = frontmatter(raw);
    // Ruta de instalación solo para skills reales (SKILL.md), no commands/x.md.
    let install: InstallLocation | undefined;
    if (basename(file) === "SKILL.md") {
      const dir = resolve(dirname(file));
      let target = dir;
      try {
        target = await realpath(dir);
      } catch {
        // target = dir si realpath falla
      }
      install = { agent, path: dir, target };
    }
    const fmPurpose = fm.purpose ?? (PURPOSE_SET.has(fm.category ?? "") ? fm.category : undefined);
    add(fm.name || fallback, fm.description ?? "", fm.category || category, agent, install, fmPurpose);
  };

  // Dirent (readdir withFileTypes) NO sigue symlinks: resuelve el tipo real.
  // Un symlink colgado (target borrado) => null => se ignora.
  async function entryType(dir: string, e: Dirent): Promise<"dir" | "file" | null> {
    if (e.isDirectory()) return "dir";
    if (e.isFile()) return "file";
    if (!e.isSymbolicLink()) return null;
    try {
      const st = await stat(join(dir, e.name));
      return st.isDirectory() ? "dir" : st.isFile() ? "file" : null;
    } catch {
      return null;
    }
  }

  // Busca SKILL.md en profundidad: skills/x/SKILL.md, el bucket anidado de
  // Claude (skills/synced/<id>/x/…) y los anidados de Codex. Salta ocultos
  // (p.ej. .system de Codex) y vendor_imports; el guard de realpath evita
  // ciclos y re-lecturas vía symlinks.
  async function scanSkills(dir: string, category: string, agent: string, seen: Set<string>, depth = 0): Promise<void> {
    if (depth > 5) return;
    let real: string;
    try {
      real = await realpath(dir);
    } catch {
      return;
    }
    if (seen.has(real)) return;
    seen.add(real);
    let entries: Dirent[];
    try {
      entries = await readDirRO(dir);
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const path = join(dir, e.name);
      const type = await entryType(dir, e);
      if (type === "dir") {
        if (e.name === "vendor_imports") continue;
        await scanSkills(path, category, agent, seen, depth + 1);
      } else if (type === "file" && e.name === "SKILL.md") {
        await readSkill(path, basename(dir), category, agent);
      }
    }
  }

  // skills/ recursivo + commands/ (x.md o x/SKILL.md), layout de Claude/Qwen.
  async function scanAgentRoot(root: string, agent: string): Promise<void> {
    for (const [sub, category] of [["skills", "skill"], ["commands", "comando"]] as const) {
      const dir = join(root, sub);
      if (sub === "skills") {
        await scanSkills(dir, category, agent, new Set());
        continue;
      }
      let entries: Dirent[];
      try {
        entries = await readDirRO(dir);
      } catch {
        continue;
      }
      for (const e of entries) {
        const type = await entryType(dir, e);
        // Soporta tanto `commands/x.md` como `commands/x/SKILL.md`.
        if (type === "dir") await readSkill(join(dir, e.name, "SKILL.md"), e.name, category, agent);
        else if (type === "file" && e.name.endsWith(".md"))
          await readSkill(join(dir, e.name), e.name.replace(/\.md$/, ""), category, agent);
      }
    }
  }

  await scanAgentRoot(roots.claudeRoot ?? join(homedir(), ".claude"), "claude-code");
  await scanAgentRoot(roots.qwenRoot ?? join(homedir(), ".qwen"), "qwen");
  await scanAgentRoot(roots.agentsRoot ?? join(homedir(), ".agents"), "agents");
  await scanSkills(join(roots.codexRoot ?? join(homedir(), ".codex"), "skills"), "skill", "codex", new Set());
  return catalog;
}

export function getSkills(
  db: DB,
  config: Config,
  catalog: Map<string, CatalogEntry>,
): { skills: SkillRow[]; categories: Record<string, number> } {
  const used = db
    .prepare(
      "SELECT skill, COUNT(*) AS uses, MAX(ts) AS lastUsed FROM skills_usage GROUP BY skill",
    )
    .all() as { skill: string; uses: number; lastUsed: string | null }[];

  const usesByName = new Map(used.map((r) => [r.skill, r]));
  const usedByAgent = db
    .prepare(`
      SELECT su.skill, s.agent, COUNT(*) AS uses
      FROM skills_usage su JOIN sessions s ON s.id = su.session_id
      GROUP BY su.skill, s.agent
    `)
    .all() as { skill: string; agent: string; uses: number }[];
  const agentsBySkill = new Map<string, { agent: string; uses: number }[]>();
  for (const row of usedByAgent) {
    const agents = agentsBySkill.get(row.skill) ?? [];
    agents.push(row);
    agentsBySkill.set(row.skill, agents);
  }
  const names = new Set<string>([...usesByName.keys(), ...catalog.keys()]);
  const home = homedir();
  const displayPath = (p: string) => (home && p.startsWith(`${home}${sep}`) ? `~${p.slice(home.length)}` : p);

  const skills: SkillRow[] = [];
  for (const name of names) {
    const u = usesByName.get(name);
    const uses = u?.uses ?? 0;
    const cat = catalog.get(name);
    const category = cat ? cat.category : BUILTIN.has(name) ? "sistema" : "otro";
    const minutesPerUse = config.minutesPerUse[name] ?? config.minutesPerUseDefault;
    const savedUsd = (uses * minutesPerUse * config.hourlyRate) / 60;
    const agents = (agentsBySkill.get(name) ?? [])
      .map((a) => ({ agent: a.agent, uses: a.uses, savedUsd: (a.uses * minutesPerUse * config.hourlyRate) / 60 }))
      .sort((a, b) => b.uses - a.uses || a.agent.localeCompare(b.agent));
    // Propósito: manual (config) > frontmatter > heurística > none.
    const meta = config.skillMeta[name];
    let purpose = "other";
    let purposeSource: SkillRow["purposeSource"] = "none";
    if (meta?.tag && meta.tag.trim()) {
      purpose = meta.tag;
      purposeSource = "manual";
    } else if (cat?.purpose) {
      purpose = cat.purpose;
      purposeSource = "frontmatter";
    } else if (cat) {
      purpose = inferPurpose(name, cat.description);
      purposeSource = "heuristic";
    }
    skills.push({
      name,
      uses,
      lastUsed: u?.lastUsed ?? null,
      category,
      savedUsd,
      minutesPerUse,
      inCatalog: !!cat,
      availableTo: cat?.agents ?? [],
      description: cat?.description ?? "",
      purpose,
      purposeSource,
      installedAt: (cat?.installedAt ?? []).map((l) => ({ ...l, path: displayPath(l.path), target: displayPath(l.target) })),
      hidden: !!meta?.hidden,
      pinned: !!meta?.pinned,
      agents,
    });
  }

  skills.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.uses - a.uses || a.name.localeCompare(b.name));

  const categories: Record<string, number> = {};
  for (const s of skills) categories[s.category] = (categories[s.category] ?? 0) + s.uses;

  return { skills, categories };
}

export interface UninstallReport {
  removed: string[]; // symlinks desenlazados
  trashed: { from: string; to: string }[]; // dirs reales movidos a la papelera
  skipped: { path: string; reason: string }[];
}

type SkillRoots = { claudeRoot?: string; codexRoot?: string; qwenRoot?: string; agentsRoot?: string };

function effectiveRoots(roots: SkillRoots): SkillRoots {
  return {
    claudeRoot: roots.claudeRoot ?? join(homedir(), ".claude"),
    codexRoot: roots.codexRoot ?? join(homedir(), ".codex"),
    qwenRoot: roots.qwenRoot ?? join(homedir(), ".qwen"),
    agentsRoot: roots.agentsRoot ?? join(homedir(), ".agents"),
  };
}

/** Solo se puede desinstalar lo que vive bajo <root>/skills/** o <root>/commands/**
 * de una raíz conocida — nunca la raíz misma ni nada fuera de ella. */
function allowedInstallPath(path: string, roots: SkillRoots): boolean {
  const abs = resolve(path);
  for (const root of Object.values(roots)) {
    if (!root) continue;
    for (const sub of ["skills", "commands"] as const) {
      const base = resolve(join(root, sub));
      if (abs !== base && abs.startsWith(`${base}${sep}`)) return true;
    }
  }
  return false;
}

/** Desinstala un skill de TODAS sus rutas de instalación. Symlinks: unlink
 * (el target compartido queda intacto). Directorios reales: se mueven a la
 * papelera bajo ./data/trash/skills (recuperable). Nunca toca nada fuera de
 * las raíces de skills. */
export async function uninstallSkill(
  name: string,
  installedAt: InstallLocation[],
  roots: SkillRoots = {},
  trashRoot = join(dataDir(), "trash", "skills"),
): Promise<UninstallReport> {
  const report: UninstallReport = { removed: [], trashed: [], skipped: [] };
  const all = effectiveRoots(roots);

  // Estado de cada ruta única (symlinks primero para no dejar enlaces colgados
  // al mover el dir real compartido a la papelera).
  const stats = new Map<string, { isLink: boolean; isDir: boolean }>();
  for (const loc of installedAt) {
    if (stats.has(loc.path)) continue;
    try {
      const st = await lstat(loc.path);
      stats.set(loc.path, { isLink: st.isSymbolicLink(), isDir: st.isDirectory() });
    } catch {
      stats.set(loc.path, { isLink: false, isDir: false });
    }
  }
  const unique = [...new Map(installedAt.map((l) => [l.path, l])).values()];
  unique.sort((a, b) => Number(stats.get(a.path)?.isDir ?? false) - Number(stats.get(b.path)?.isDir ?? false));

  for (const loc of unique) {
    const st = stats.get(loc.path);
    if (!st || (!st.isLink && !st.isDir)) {
      report.skipped.push({ path: loc.path, reason: "no existe" });
      continue;
    }
    if (!allowedInstallPath(loc.path, all)) {
      report.skipped.push({ path: loc.path, reason: "fuera de las raíces de skills" });
      continue;
    }
    if (st.isLink) {
      try {
        await unlink(loc.path);
        report.removed.push(loc.path);
      } catch {
        report.skipped.push({ path: loc.path, reason: "no se pudo desenlazar" });
      }
      continue;
    }
    const dest = join(trashRoot, `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}`);
    try {
      await mkdir(trashRoot, { recursive: true });
      try {
        await rename(loc.path, dest);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EXDEV") throw err;
        await cp(loc.path, dest, { recursive: true }); // trash en otro filesystem
        await rm(loc.path, { recursive: true, force: true });
      }
      report.trashed.push({ from: loc.path, to: dest });
    } catch {
      report.skipped.push({ path: loc.path, reason: "no se pudo mover a la papelera" });
    }
  }
  return report;
}
