/**
 * Registro de probers integrados del pack (F1: claude/codex/zai ·
 * F2: gemini/copilot/openrouter). Se pasa al framework del motor
 * (`runQuotaProbers`/`refreshQuota`) — el motor no trae ninguno.
 */
import type { QuotaProbers } from "agent-usage-engine";
import { probeClaude } from "./probers/claude.js";
import { probeCodex } from "./probers/codex.js";
import { probeZai } from "./probers/zai.js";
import { probeGemini } from "./probers/gemini.js";
import { probeCopilot } from "./probers/copilot.js";
import { probeOpenRouter } from "./probers/openrouter.js";

/** Todos los probers (F1: claude/codex/zai · F2: gemini/copilot/openrouter). */
export const ALL_PROBERS: QuotaProbers = {
  claude: probeClaude,
  codex: probeCodex,
  zai: probeZai,
  gemini: probeGemini,
  copilot: probeCopilot,
  openrouter: probeOpenRouter,
};
