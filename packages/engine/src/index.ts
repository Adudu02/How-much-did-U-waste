/**
 * API pública del paquete agent-usage-engine — el motor genérico de medición.
 * Un consumidor —el dashboard de DFT, un check de CI, OTRA app cualquiera—
 * importa TODO desde aquí, no de rutas internas. El motor no conoce agentes,
 * ni Fastify, ni React, ni el CLI; solo ingiere adapters inyectados (solo
 * lectura), calcula costos equiv-API y persiste métricas (nunca prompts).
 *
 * Uso como librería en cualquier proyecto:
 *   import { setDataDir, ingestAll, openDb, defaultDbPath, getSummary } from "agent-usage-engine";
 *   setDataDir("/ruta/estado");            // dónde vive la DB (default: <cwd>/data)
 *   await ingestAll(db, { adapters: misAdapters });  // tus propios adapters
 */

// Configuración de rutas de estado + preparación del directorio (setup del motor,
// compartido por todos los consumidores: app, reporter de CI, etc.).
export { dataDir, setDataDir, packagedPricingPath, ensureUserData, homePath } from "./lib/paths.js";

// Modelo normalizado + contratos de adapters (el motor no trae ninguno).
export * from "./adapters/types.js";
export * from "./adapters/contracts.js";

// Pipeline de ingesta incremental (recibe los adapters del llamador).
export * from "./ingest.js";

// Persistencia (métricas, nunca prompts).
export * from "./lib/db.js";
export { dayInTz, toIsoTimestamp } from "./lib/time.js";

// Tarifas del usuario + actualizador desde fuentes curadas (LiteLLM, models.dev).
export * from "./lib/pricing.js";
export * from "./lib/pricing-update.js";

// Framework de quota probes: contrato + runner inyectable (sin probers concretos).
export * from "./quota/types.js";
export * from "./quota/cache.js";
export * from "./quota/probers.js";
export * from "./quota/refresh.js";

// IO de solo lectura: política de seguridad del motor, reutilizable por los
// consumidores y por las capas de dominio (insights).
export * from "./lib/fs-readonly.js";
export * from "./lib/sqlite-snapshot.js";

// Motor de costos y vistas derivadas.
export * from "./lib/cost.js";
export * from "./lib/aggregate.js";
export * from "./lib/summary.js";
export * from "./lib/activity.js";
export * from "./lib/export.js";
export * from "./lib/report.js";

// Config store genérico dirigido por schema (defaults + allowlist + merge
// parcial + guardado atómico). El schema lo aporta el consumidor.
export * from "./lib/config-store.js";

/**
 * TIER 2 — dominio del dashboard (NO vive en este paquete):
 *   config (tarifa/hora, agentPaths), waste (hallazgos de fuga), skills
 *   (catálogo) y memory (grafo de Claude Code) viven en
 *   `how-much-did-u-waste-insights`. Los adapters de agentes concretos viven
 *   en `agent-usage-adapters` (o los inyecta cualquier proyecto externo).
 */
