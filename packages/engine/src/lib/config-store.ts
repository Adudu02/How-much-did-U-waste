/**
 * Config store genérico dirigido por schema: carga con defaults, validación
 * delegada (allowlist de claves, rechazo de desconocidas), merge de updates
 * parciales y guardado atómico (archivo temporal + rename). El schema lo
 * aporta el consumidor — el motor no conoce ninguna clave de producto.
 *
 * Política IO: lectura con la bandera de solo lectura (readFileRO); la
 * escritura atómica escribe `.<path>.tmp` y renombra, de modo que un fallo a
 * mitad de guardado nunca corrompe el archivo previo.
 */
import { rename, writeFile } from "node:fs/promises";
import { readFileRO } from "./fs-readonly.js";

/** Schema aportado por el consumidor: defaults + validación + merge. */
export interface ConfigStoreSchema<T extends object> {
  /** Config completa por defecto (se usa cuando falta el archivo). */
  defaults: T;
  /**
   * Valida SOLO las claves recibidas (para preservar updates parciales).
   * SHALL lanzar ante claves desconocidas o valores inválidos.
   */
  validate(value: unknown): Partial<T>;
  /** Combina un parcial sobre una config base completa. Puro. */
  merge(base: T, partial: Partial<T>): T;
}

export interface ConfigStore<T extends object> {
  /** Carga y valida; si falta o falla el archivo devuelve los defaults. */
  load(path: string): Promise<T>;
  /** Valida el parcial, lo mergea sobre lo existente y persiste atómicamente. */
  save(partial: Partial<T>, path: string): Promise<T>;
}

export function createConfigStore<T extends object>(schema: ConfigStoreSchema<T>): ConfigStore<T> {
  async function readRaw(path: string): Promise<unknown> {
    return JSON.parse(await readFileRO(path));
  }

  async function writeAtomic(path: string, value: T): Promise<void> {
    const tmp = `${path}.tmp`;
    await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(tmp, path);
  }

  return {
    async load(path: string): Promise<T> {
      try {
        return schema.merge(schema.defaults, schema.validate(await readRaw(path)));
      } catch {
        return { ...schema.defaults }; // sin archivo (o inválido) => defaults
      }
    },

    async save(partial: Partial<T>, path: string): Promise<T> {
      const valid = schema.validate(partial);
      const current = await this.load(path);
      const next = schema.merge(current, valid);
      await writeAtomic(path, next);
      return next;
    },
  };
}
