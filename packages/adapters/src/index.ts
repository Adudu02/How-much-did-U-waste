/**
 * API pública del paquete agent-usage-adapters — el pack de adapters de
 * agentes de código para `agent-usage-engine`. Incluye los 10 adapters de
 * ingesta/sincronización (Claude Code, Codex, Qwen, ZCode, Gemini CLI,
 * OpenCode, grok-cli, Goose, Amp, Crush), el registry con sus raíces por
 * defecto y traducción de `config.agentPaths`, y los probers de quota
 * integrados con su registry `ALL_PROBERS`.
 *
 * Uso (combinado con el motor):
 *   import { ingestAll } from "agent-usage-engine";
 *   import { getIngestAdapters, getSyncAdapters } from "agent-usage-adapters";
 *   await ingestAll(db, { adapters: getIngestAdapters(), syncAdapters: getSyncAdapters() });
 *
 * Este paquete NO re-exporta el motor: importa los contratos desde
 * `agent-usage-engine`, que sigue siendo la fuente de tipos y pipeline.
 */

// Adapters de archivo + de sincronización + parsers/clases por agente.
export * from "./adapters/claude-code.js";
export * from "./adapters/codex.js";
export * from "./adapters/qwen.js";
export * from "./adapters/zcode.js";
export * from "./adapters/gemini.js";
export * from "./adapters/opencode.js";
export * from "./adapters/grok.js";
export * from "./adapters/goose.js";
export * from "./adapters/amp.js";
export * from "./adapters/crush.js";

// Registry: adapters activos con raíces por defecto + agentPaths.
export { getIngestAdapters, getSyncAdapters, rootsFromConfig } from "./adapters/registry.js";

// Quota: registry integrado + refresh con defaults del pack.
export { ALL_PROBERS } from "./quota/all-probers.js";
export { refreshQuota, type RefreshQuotaOptions } from "./quota/refresh.js";
