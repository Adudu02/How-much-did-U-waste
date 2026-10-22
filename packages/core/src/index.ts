/**
 * API pública del paquete how-much-did-u-waste-core. FACADE: este paquete ya
 * no contiene código propio — re-exporta el motor genérico
 * (`agent-usage-engine`) + el pack de adapters de agentes
 * (`agent-usage-adapters`) y envuelve `ingestAll`/`refreshQuota` con sus
 * defaults históricos (registry integrado, firma por raíces), de modo que la
 * API pública de siempre no cambia para insights, reporter, la app root ni
 * los consumidores npm.
 *
 * Un consumidor —el dashboard de este repo, un check de CI, otra app— importa
 * TODO desde aquí, no de rutas internas. El motor no conoce Fastify, React ni
 * el CLI; solo lee fuentes (solo-lectura), calcula costos equiv-API, detecta
 * fugas y persiste métricas.
 *
 * Uso como librería:
 *   import { setDataDir, rebuild, getWaste, openDb, defaultDbPath } from "how-much-did-u-waste-core";
 *   setDataDir("/ruta/estado");          // dónde vive la DB/reportes (default: <cwd>/data)
 *   await rebuild();                      // ingiere todas las fuentes
 *   const { findings } = getWaste(openDb(defaultDbPath()), ...);
 *
 * Un proyecto NUEVO que quiera solo medición puede depender directamente de
 * `agent-usage-engine` (+ `agent-usage-adapters` si quiere estos agentes) sin
 * pasar por este facade.
 */

// Motor genérico completo: rutas de estado, modelo normalizado, contratos,
// pipeline (la ingestAll del motor queda sombreada por el wrapper de abajo),
// DB, pricing, quota framework, IO read-only, costos y vistas derivadas.
export * from "agent-usage-engine";

// Pack de adapters: 10 agentes + registry con raíces por defecto + probers.
export * from "agent-usage-adapters";

// Wrappers con la firma/defaults históricos de este paquete (sombrean a los
// del motor: ingestAll por raíces, refreshQuota con ALL_PROBERS).
export { ingestAll, type IngestAllOpts } from "./ingest.js";
export { refreshQuota } from "agent-usage-adapters";

/**
 * TIER 2 — dominio del dashboard (NO vive en este paquete):
 *   config (tarifa/hora, agentPaths), waste (hallazgos de fuga), skills
 *   (catálogo) y memory (grafo de Claude Code) viven en
 *   `how-much-did-u-waste-insights`, junto con el orquestador `rebuild` que
 *   combina ingesta + memoria. Este paquete es la medición genérica; si solo
 *   querés medir tokens, no necesitás insights.
 */
