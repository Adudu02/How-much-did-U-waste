import { useEffect, useState } from "react";
import { useApi } from "../hooks.js";
import type { Config, WasteThresholds } from "../types.js";
import { Panel } from "../components/Panel.js";
import { Loading } from "../components/Loading.js";
import { Field } from "../components/Field.js";
import { useLocale } from "../i18n.js";

function formatPricingDate(value: string, timeZone: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return date.toLocaleString(locale, { timeZone: timeZone || undefined });
  } catch {
    return value;
  }
}

export function Configuracion() {
  const { t, locale, setLocale, localizeError } = useLocale();
  const [key, setKey] = useState(0);
  const { data: cfg } = useApi<Config>("/api/config", key, false);
  const { data: pricingStatus } = useApi<{ status: string; ageDays: number | null; maxAgeDays: number; verifiedAt: string | null }>(
    "/api/pricing-status",
    key,
  );
  const [form, setForm] = useState<Config | null>(null);
  const [downgradeText, setDowngradeText] = useState<string>("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [failed, setFailed] = useState(false);
  const [pricingBusy, setPricingBusy] = useState(false);
  useEffect(() => {
    if (cfg) {
      setForm(cfg);
      setDowngradeText(JSON.stringify(cfg.waste.downgradePaths, null, 2));
      setJsonError(null);
    }
  }, [cfg]);
  if (!form) return <Loading />;

  const saveConfig = async () => {
    const response = await fetch("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json();
    setFailed(!response.ok);
    setMsg(response.ok ? t("settings.saved") : t("settings.error", { message: localizeError(result.error ?? t("settings.invalidConfig")) }));
    if (response.ok && result.config) setForm(result.config);
  };
  const refreshPricing = async () => {
    setPricingBusy(true);
    setFailed(false);
    setMsg("");
    try {
      const response = await fetch("/api/pricing/refresh", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setFailed(true);
        setMsg(t("settings.error", { message: localizeError(result.report?.error ?? result.error ?? t("settings.priceUpdateFailed")) }));
      } else {
        const report = result.report;
        setMsg(t("settings.priceUpdateResult", { updated: report.updated.length, added: report.added.length, unchanged: report.unchanged.length, missing: report.missingRate.length }));
        setKey((k) => k + 1);
      }
    } catch (e) {
      setFailed(true);
      setMsg(t("settings.error", { message: String(e) }));
    } finally {
      setPricingBusy(false);
    }
  };
  const rebuild = async () => {
    setMsg(t("settings.rebuilding"));
    setFailed(false);
    const r = await fetch("/api/rebuild", { method: "POST" });
    const j = await r.json();
    setMsg(t("settings.rebuildResult", { skills: j.skillsInserted ?? 0, events: j.eventsInserted, memories: j.memories }));
    setKey((k) => k + 1);
  };
  const num = (k: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: Number(e.target.value) });
  // Edición libre: el texto local manda; solo un parseo exitoso entra a `form`.
  const editDowngrade = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setDowngradeText(text);
    try {
      const paths = JSON.parse(text);
      setJsonError(null);
      setForm({ ...form, waste: { ...form.waste, downgradePaths: paths } });
    } catch (err) {
      setJsonError(String(err));
    }
  };
  const numW = (k: keyof WasteThresholds) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, waste: { ...form.waste, [k]: Number(e.target.value) } });
  const pricingLabel = pricingStatus?.status === "fresh"
    ? t("settings.fresh")
    : pricingStatus?.status === "stale"
      ? t("settings.stale", { age: pricingStatus.ageDays ?? "?", ttl: pricingStatus.maxAgeDays })
      : t("settings.unverified");
  const pricingColor = pricingStatus?.status === "fresh"
    ? "text-term-green border-term-green/30 bg-term-green/5"
    : pricingStatus?.status === "stale"
      ? "text-term-red border-term-red/30 bg-term-red/5"
      : "text-term-muted border-term-border bg-term-bg";
  const verifiedAt = pricingStatus?.verifiedAt
    ? formatPricingDate(pricingStatus.verifiedAt, form.timeZone, locale)
    : t("settings.unverified");
  const pricingSource = cfg?.pricing.source === "modelsdev" ? t("settings.pricingSourceModelsdev") : t("settings.pricingSourceLitellm");

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-4 content-start">
        <Panel title={t("settings.general")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field label={t("settings.language")}>
              <select value={locale} onChange={(e) => setLocale(e.target.value as typeof locale)} className="in">
                <option value="es-MX">{t("settings.spanish")}</option>
                <option value="en-US">{t("settings.english")}</option>
              </select>
            </Field>
            <Field label={t("settings.hourlyRate")}>
              <input type="number" value={form.hourlyRate} onChange={num("hourlyRate")} className="in" />
            </Field>
            <Field label={t("settings.staleDays")}>
              <input type="number" value={form.staleDays} onChange={num("staleDays")} className="in" />
            </Field>
            <Field label={t("settings.minutesPerUse")}>
              <input type="number" value={form.minutesPerUseDefault} onChange={num("minutesPerUseDefault")} className="in" />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("settings.timeZone")}>
                <input
                  type="text"
                  placeholder="America/Merida"
                  value={form.timeZone}
                  onChange={(e) => setForm({ ...form, timeZone: e.target.value })}
                  className="in"
                />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel title={t("settings.wasteThresholds")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4">
            <Field label={t("settings.minCacheHit")}>
              <input type="number" step="0.05" value={form.waste.minCacheRatio} onChange={numW("minCacheRatio")} className="in" />
            </Field>
            <Field label={t("settings.minInput")}>
              <input type="number" value={form.waste.minInputTokens} onChange={numW("minInputTokens")} className="in" />
            </Field>
            <Field label={t("settings.bloatTurns")}>
              <input type="number" value={form.waste.bloatTurns} onChange={numW("bloatTurns")} className="in" />
            </Field>
            <Field label={t("settings.bloatTokens")}>
              <input type="number" value={form.waste.bloatTokens} onChange={numW("bloatTokens")} className="in" />
            </Field>
            <Field label={t("settings.expensiveRate")}>
              <input type="number" step="0.5" value={form.waste.expensiveInputRate} onChange={numW("expensiveInputRate")} className="in" />
            </Field>
            <Field label={t("settings.trivialOutput")}>
              <input type="number" value={form.waste.trivialOutputTokens} onChange={numW("trivialOutputTokens")} className="in" />
            </Field>
            <Field label={t("settings.trivialTurns")}>
              <input type="number" value={form.waste.mismatchMinTurns} onChange={numW("mismatchMinTurns")} className="in" />
            </Field>
          </div>
        </Panel>

        <Panel>
          <details>
            <summary className="kicker uppercase tracking-widest cursor-pointer select-none flex items-center gap-1.5 [&::-webkit-details-marker]:hidden hover:text-term-amber">
              <svg aria-hidden="true" viewBox="0 0 20 20" className="w-3 h-3 flex-none transition-transform details-chevron" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 5l6 5-6 5" />
              </svg>
              {t("settings.advancedPaths")}
            </summary>
            <div className="mt-3">
              <textarea
                value={downgradeText}
                onChange={editDowngrade}
                spellCheck={false}
                className={`w-full h-48 bg-term-bg border rounded-lg p-2 text-xs font-mono text-term-amber ${
                  jsonError ? "border-term-red" : "border-term-border"
                }`}
              />
              {jsonError && <div className="text-xs text-term-red mt-1">{t("settings.invalidJson", { error: jsonError })}</div>}
              <div className="text-xs text-term-muted mt-1">{t("settings.downgradeHelp")}</div>
            </div>
          </details>
        </Panel>

        <Panel title={t("settings.agentPaths")}>
          <Field label={t("settings.claudePath")}>
            <input
              type="text"
              placeholder="~/.claude/projects"
              value={form.agentPaths["claude-code"] ?? ""}
              onChange={(e) => setForm({ ...form, agentPaths: { ...form.agentPaths, "claude-code": e.target.value } })}
              className="in"
            />
          </Field>
          <Field label={t("settings.codexPath")}>
            <input
              type="text"
              placeholder="~/.codex"
              value={form.agentPaths.codex ?? ""}
              onChange={(e) => setForm({ ...form, agentPaths: { ...form.agentPaths, codex: e.target.value } })}
              className="in"
            />
          </Field>
          <Field label={t("settings.qwenPath")}>
            <input
              type="text"
              placeholder="~/.qwen"
              value={form.agentPaths.qwen ?? ""}
              onChange={(e) => setForm({ ...form, agentPaths: { ...form.agentPaths, qwen: e.target.value } })}
              className="in"
            />
          </Field>
          <div className="text-xs text-term-muted">{t("settings.rebuildPaths")}</div>
        </Panel>

        <button type="button" onClick={saveConfig} disabled={jsonError !== null} className="btn justify-self-start disabled:opacity-50 disabled:cursor-not-allowed">
          {t("settings.save")}
        </button>
      </div>

      <Panel title={t("settings.prices")}>
        <div className="grid gap-2 mb-3 text-xs">
          <span className={`w-fit rounded-full border px-2 py-1 ${pricingColor}`}>{pricingLabel}</span>
          <div className="text-term-muted">{t("settings.verified")} {verifiedAt} · {t("settings.source")} {pricingSource}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={refreshPricing} disabled={pricingBusy} className="btn disabled:opacity-50 disabled:cursor-not-allowed">
            {pricingBusy ? t("settings.updatePricesBusy") : t("settings.updatePrices")}
          </button>
          <button type="button" onClick={rebuild} className="btn">{t("settings.rebuild")}</button>
        </div>
      </Panel>

      {msg && <div className={`md:col-span-2 text-xs ${failed ? "text-term-red" : "text-term-green"}`}>{msg}</div>}
    </div>
  );
}
