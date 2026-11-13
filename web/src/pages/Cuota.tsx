import { useMemo, useState } from "react";
import { useApi, refreshQuota } from "../hooks.js";
import { AgentLogo } from "../components/AgentLogos.js";
import { Empty } from "../components/Empty.js";
import { Loading } from "../components/Loading.js";
import { PROVIDER_LABEL, PROVIDER_LOGO, barColor, type QuotaResponse, type QuotaSnapshot } from "../components/QuotaSection.js";
import { useLocale, type MessageKey } from "../i18n.js";

/**
 * Vista de cuota: pestañas por proveedor (con conteo), búsqueda y una tarjeta
 * por proveedor con una barra por modelo/ventana. Solo muestra datos que ya
 * están en la caché local de cuota — nunca identificadores de cuenta.
 */
const WINDOW_KEYS: Record<string, MessageKey> = {
  five_hour: "quota.window.five_hour",
  weekly: "quota.window.weekly",
  monthly: "quota.window.monthly",
};

interface ProviderGroup {
  provider: string;
  label: string;
  plan?: string;
  models: { model?: string; rows: QuotaSnapshot[] }[];
  rows: QuotaSnapshot[];
}

function groupByProvider(snapshots: QuotaSnapshot[]): ProviderGroup[] {
  const byProvider = new Map<string, QuotaSnapshot[]>();
  for (const s of snapshots) {
    if (s.usedPercent === undefined) continue;
    byProvider.set(s.provider, [...(byProvider.get(s.provider) ?? []), s]);
  }
  return [...byProvider.entries()].map(([provider, rows]) => {
    const byModel = new Map<string, QuotaSnapshot[]>();
    for (const r of rows) byModel.set(r.model ?? "", [...(byModel.get(r.model ?? "") ?? []), r]);
    return {
      provider,
      label: PROVIDER_LABEL[provider] ?? provider,
      plan: rows.find((r) => r.plan)?.plan,
      models: [...byModel.entries()].map(([model, mrows]) => ({ model: model || undefined, rows: mrows })),
      rows,
    };
  });
}

function relativeReset(iso: string, locale: string): string | null {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always", style: "narrow" });
  const abs = Math.abs(ms);
  if (abs < 3_600_000) return rtf.format(Math.round(ms / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(ms / 3_600_000), "hour");
  return rtf.format(Math.round(ms / 86_400_000), "day");
}

function Row({ s }: { s: QuotaSnapshot }) {
  const { t, locale, formatDate } = useLocale();
  const pct = Math.min(100, Math.max(0, Math.round(s.usedPercent ?? 0)));
  const key = WINDOW_KEYS[s.window];
  const name = key ? t(key) : t("quota.window.other", { window: s.window });
  const rel = s.resetsAt ? relativeReset(s.resetsAt, locale) : null;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-term-text">
          {name}
          {s.origin === "offline-stale" && <span className="text-term-muted">{t("quota.offline")}</span>}
        </span>
        <span className="num text-term-text text-sm">{pct}%</span>
      </div>
      <div
        className="h-2 mt-1 bg-term-bg border border-term-border rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${name} ${pct}% ${t("quota.used")}`}
      >
        <div className={`h-full ${barColor(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      {s.resetsAt && (
        <div className="text-term-muted text-[11px] mt-1">
          {t("quota.reset", { date: formatDate(s.resetsAt, { dateStyle: "medium", timeStyle: "short" }) })}
          {rel && ` · ${rel}`}
        </div>
      )}
    </div>
  );
}

function ProviderCard({ g }: { g: ProviderGroup }) {
  const { t } = useLocale();
  const logo = PROVIDER_LOGO[g.provider];
  return (
    <article className="card2 fade-in min-w-0 p-5">
      <header className="flex items-center gap-2 mb-3">
        {logo && <AgentLogo id={logo} />}
        <h2 className="text-sm font-semibold text-term-text truncate">{g.label}</h2>
        {g.plan && (
          <span className="ml-auto text-[11px] text-term-muted">
            {t("quota.plan")} <span className="text-term-text font-medium">{g.plan}</span>
          </span>
        )}
      </header>
      {g.models.map((m) => (
        <section key={m.model ?? "_"} className="mb-4 last:mb-0">
          {m.model && <div className="kicker uppercase tracking-widest text-[10px] mb-2">{m.model}</div>}
          {m.rows.map((s, i) => (
            <Row key={`${s.window}-${i}`} s={s} />
          ))}
        </section>
      ))}
    </article>
  );
}

export function Cuota() {
  const { t } = useLocale();
  const { data, error } = useApi<QuotaResponse>("/api/quota");
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => groupByProvider(data?.snapshots ?? []), [data]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((g) => tab === "all" || g.provider === tab)
      .filter((g) => !q || [g.label, g.plan, ...g.models.map((m) => m.model)].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [groups, tab, query]);

  if (error) return <Empty msg={t("quota.error")} />;
  if (!data) return <Loading />;

  const status =
    data.status === "live" ? t("quota.live")
      : data.status === "stale" ? t("quota.stale", { minutes: data.ageMinutes ?? "?" })
        : data.status === "no-credential" ? t("quota.noCredential")
          : data.status === "disabled" ? t("quota.disabled")
            : data.status === "error" ? t("quota.error") : data.status;

  const run = async () => {
    setBusy(true);
    await refreshQuota();
    setBusy(false);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div role="tablist" aria-label={t("nav.quota")} className="flex flex-wrap gap-1.5">
          {[{ id: "all", label: t("quota.all"), count: groups.length }, ...groups.map((g) => ({ id: g.provider, label: g.label, count: g.models.length }))].map((tb) => (
            <button
              key={tb.id}
              type="button"
              role="tab"
              aria-selected={tab === tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === tb.id ? "bg-term-amber/10 text-term-amber" : "text-term-muted hover:bg-black/[0.03] hover:text-term-text"
              }`}
            >
              {tb.id !== "all" && PROVIDER_LOGO[tb.id] && <AgentLogo id={PROVIDER_LOGO[tb.id]} />}
              {tb.label}
              <span className="num text-[11px] text-term-muted">{tb.count}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-term-muted">
          <span>{status}</span>
          <button type="button" onClick={run} disabled={busy} className="chip px-3 py-1.5 rounded-lg border border-term-border text-term-text hover:bg-black/[0.03] disabled:opacity-60">
            {busy ? t("quota.refreshing") : t("quota.refresh")}
          </button>
        </div>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("quota.search")}
        aria-label={t("quota.search")}
        className="w-full max-w-md mb-5 rounded-lg border border-term-border bg-term-panel px-3 py-2 text-sm text-term-text placeholder:text-term-muted focus:outline-none focus:border-term-amber"
      />

      {groups.length === 0 ? (
        <Empty msg={t("quota.empty")} />
      ) : visible.length === 0 ? (
        <Empty msg={t("quota.noResults")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((g) => (
            <ProviderCard key={g.provider} g={g} />
          ))}
        </div>
      )}
    </div>
  );
}
