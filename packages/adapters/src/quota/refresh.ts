/**
 * Refresh de quota con el registry INTEGRADO del pack: igual que el
 * orquestador del motor, pero defaulting `probers` a `ALL_PROBERS` para que
 * los consumidores del pack (server, CLI) no tengan que pasar nada.
 */
import { refreshQuota as engineRefreshQuota, type RefreshQuotaOptions } from "agent-usage-engine";
import { ALL_PROBERS } from "./all-probers.js";

export type { RefreshQuotaOptions };

export async function refreshQuota(
  opts: RefreshQuotaOptions = {},
): Promise<ReturnType<typeof engineRefreshQuota>> {
  return engineRefreshQuota({ probers: ALL_PROBERS, ...opts });
}
