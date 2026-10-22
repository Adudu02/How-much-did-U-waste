/**
 * Contratos de adapters del motor genérico. El motor NO conoce ningún agente:
 * cada consumidor construye sus adapters (o usa un pack como
 * `agent-usage-adapters`) y los inyecta a `ingestAll`.
 */
import type { ParsedLine, SkillUsage } from "./types.js";
import type { DB } from "../lib/db.js";

export interface IngestAdapter {
  id: string;
  discover(): Promise<string[]>;
  /** raw = archivo COMPLETO (la meta suele estar en la línea 0). */
  deriveIds(path: string, raw: string): { sessionId: string; project: string };
  parseLines(
    raw: string,
    fromLine: number,
    sessionId: string,
  ): { events: ParsedLine[]; lineCount: number; skipped: number };
  parseSkills(raw: string, fromLine: number): SkillUsage[];
  /**
   * Si true, el archivo contiene eventos de múltiples sesiones (ej: Qwen usage files).
   * Los events devueltos por parseLines tienen su propio sessionId (no el pasado como arg).
   * El pipeline de ingesta creará entradas en sessions para cada sessionId único encontrado.
   */
  multiSession?: boolean;
  /** El archivo solo aporta skills y offsets; no es dueño de sesiones/eventos. */
  skillsOnly?: true;
}

/**
 * Adapters de fuentes SQLite vivas: el adapter es dueño de su fuente
 * (snapshot read-only, directorio JSON…) y sincroniza filas él mismo
 * (semántica por tipo de fila: acumulativa vs append-only).
 */
export interface SyncAdapter {
  id: string;
  /** Sincroniza su fuente hacia `target`. Conteo honesto de escrituras. */
  sync(target: DB): Promise<{ eventsInserted: number; skipped: number }>;
}
