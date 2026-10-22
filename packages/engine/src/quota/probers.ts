/**
 * Framework de probers de quota del motor genérico: contrato + ejecución EN
 * PARALELO y aislada — el fallo individual degrada a `error` con causa
 * sanitizada sin afectar al resto. El motor NO incluye probers concretos;
 * cada consumidor inyecta su registry (ej: `ALL_PROBERS` del pack
 * `agent-usage-adapters`).
 */
import type { ProberContext, QuotaProviderResult, QuotaSnapshot } from "./types.js";

export type QuotaProber = (ctx: ProberContext) => Promise<QuotaSnapshot[]>;
export type QuotaProbers = Record<string, QuotaProber>;

function withTimeout(prober: QuotaProber, ctx: ProberContext): Promise<QuotaSnapshot[]> {
  return Promise.race([
    prober(ctx),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timeout ${ctx.timeoutMs}ms`)), ctx.timeoutMs)),
  ]);
}

/**
 * Corre los probers habilitados en paralelo. `providers` selecciona (ej:
 * claude|codex|zai). Los deshabilitados reportan `disabled`.
 */
export async function runQuotaProbers(
  probers: QuotaProbers,
  enabled: Record<string, boolean>,
  ctx: Omit<ProberContext, "fetchImpl" | "now" | "timeoutMs">,
  opts: { fetchImpl?: typeof fetch; now?: () => Date; timeoutMs?: number } = {},
): Promise<QuotaProviderResult[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? (() => new Date());
  const timeoutMs = opts.timeoutMs ?? 15_000;

  return Promise.all(
    Object.entries(probers).map(async ([provider, prober]) => {
      if (enabled[provider] === false) return { provider, status: "disabled" as const, snapshots: [] };
      const fullCtx: ProberContext = { ...ctx, fetchImpl, now, timeoutMs };
      try {
        const snapshots = await withTimeout(prober, fullCtx);
        return { provider, status: "live" as const, snapshots };
      } catch (err) {
        const message = String((err as Error)?.message ?? err);
        const status = message.includes("no-credential") ? ("no-credential" as const) : ("error" as const);
        return { provider, status, error: message.replace("no-credential: ", ""), snapshots: [] };
      }
    }),
  );
}
