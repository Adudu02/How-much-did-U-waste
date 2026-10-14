import { useEffect, useState } from "react";
import { useApi } from "../hooks.js";
import type { SkillRow } from "../types.js";
import { Panel } from "../components/Panel.js";
import { Loading } from "../components/Loading.js";
import { ErrorMsg } from "../components/ErrorMsg.js";
import { Empty } from "../components/Empty.js";
import { useLocale } from "../i18n.js";

const PURPOSE_OPTIONS = ["code", "productivity", "investigation", "docs", "devops", "security", "other"] as const;
const PURPOSE_LABEL_KEYS = {
  code: "skills.purposeCode",
  productivity: "skills.purposeProductivity",
  investigation: "skills.purposeInvestigation",
  docs: "skills.purposeDocs",
  devops: "skills.purposeDevops",
  security: "skills.purposeSecurity",
  other: "skills.purposeOther",
} as const;
const PURPOSE_SOURCE_LABEL_KEYS = {
  manual: "skills.sourceManual",
  frontmatter: "skills.sourceFrontmatter",
  heuristic: "skills.sourceHeuristic",
  none: "skills.sourceNone",
} as const;
const SORTS = ["uses", "name", "saved", "lastUsed", "purpose", "path"] as const;
const SORT_LABEL_KEYS: Record<(typeof SORTS)[number], "skills.sortUses" | "skills.sortName" | "skills.sortSaved" | "skills.sortLastUsed" | "skills.sortPurpose" | "skills.sortPath"> = {
  uses: "skills.sortUses",
  name: "skills.sortName",
  saved: "skills.sortSaved",
  lastUsed: "skills.sortLastUsed",
  purpose: "skills.sortPurpose",
  path: "skills.sortPath",
};
const SORT_KEY = "skills.sort";

function sortSkills(skills: SkillRow[], sort: (typeof SORTS)[number]): SkillRow[] {
  const byName = (a: SkillRow, b: SkillRow) => a.name.localeCompare(b.name);
  const cmp: Record<(typeof SORTS)[number], (a: SkillRow, b: SkillRow) => number> = {
    uses: (a, b) => b.uses - a.uses || byName(a, b),
    name: byName,
    saved: (a, b) => b.savedUsd - a.savedUsd || byName(a, b),
    lastUsed: (a, b) => (b.lastUsed ?? "").localeCompare(a.lastUsed ?? "") || byName(a, b),
    purpose: (a, b) => a.purpose.localeCompare(b.purpose) || byName(a, b),
    path: (a, b) =>
      (a.installedAt[0] ? `${a.installedAt[0].agent} ${a.installedAt[0].path}` : a.name)
        .localeCompare(b.installedAt[0] ? `${b.installedAt[0].agent} ${b.installedAt[0].path}` : b.name) || byName(a, b),
  };
  // Fijados siempre arriba, independiente del criterio.
  return [...skills].sort((a, b) => Number(b.pinned) - Number(a.pinned) || cmp[sort](a, b));
}

export function Skills() {
  const { t, usd, localizeError, formatDate, locale } = useLocale();
  const purposeLabel = (p: string) => (p in PURPOSE_LABEL_KEYS ? t(PURPOSE_LABEL_KEYS[p as keyof typeof PURPOSE_LABEL_KEYS]) : p);
  const categoryLabel = (c: string) => c === "sistema" ? t("skills.categorySystem") : c === "otro" ? t("skills.categoryOther") : c;
  const purposeSourceLabel = (source: string) => (source in PURPOSE_SOURCE_LABEL_KEYS ? t(PURPOSE_SOURCE_LABEL_KEYS[source as keyof typeof PURPOSE_SOURCE_LABEL_KEYS]) : source);
  const [reload, setReload] = useState(0);
  const { data, error } = useApi<{ skills: SkillRow[]; categories: Record<string, number> }>("/api/skills", reload, false);
  const [filter, setFilter] = useState<string>("todas");
  const [purpose, setPurpose] = useState<string>("todas");
  const [sort, setSort] = useState<(typeof SORTS)[number]>(() => {
    const saved = localStorage.getItem(SORT_KEY);
    return (SORTS as readonly string[]).includes(saved ?? "") ? (saved as (typeof SORTS)[number]) : "uses";
  });
  const [showHidden, setShowHidden] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    localStorage.setItem(SORT_KEY, sort);
  }, [sort]);
  if (error) return <ErrorMsg msg={error} />;
  if (!data) return <Loading />;

  const mutate = async (path: string, method: string, body?: unknown) => {
    setMsg(null);
    try {
      const r = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; report?: { removed: string[]; trashed: { from: string }[] } };
      if (!r.ok) {
        setMsg(t("skills.error", { message: localizeError(j.error ?? String(r.status)) }));
        return null;
      }
      if (method === "DELETE" && j.report) {
        const n = j.report.removed.length + j.report.trashed.length;
        setMsg(t("skills.uninstalled", { count: n, unit: locale === "en-US" ? (n === 1 ? "path" : "paths") : n === 1 ? "ruta" : "rutas" }));
      }
      setReload((k) => k + 1);
      return j;
    } catch (e) {
      setMsg(t("skills.error", { message: localizeError(String(e)) }));
      return null;
    }
  };

  const uninstall = (s: SkillRow) => {
    const rutas = s.installedAt.map((l) => `${l.agent}: ${l.path}`).join("\n  ");
    const extra = s.installedAt.length > 1 ? t("skills.uninstallAllWarning", { count: s.installedAt.length }) : "";
    if (!window.confirm(t("skills.uninstallConfirm", { name: s.name, paths: rutas, extra }))) return;
    void mutate(`/api/skills/${encodeURIComponent(s.name)}`, "DELETE");
  };

  const cats = ["todas", ...Object.keys(data.categories).sort()];
  const purposes = ["todas", ...new Set(data.skills.filter((s) => !s.hidden || showHidden).map((s) => s.purpose))].sort((a, b) => (a === "todas" ? -1 : b === "todas" ? 1 : a.localeCompare(b)));
  const visible = data.skills.filter((s) => (showHidden || !s.hidden) && (filter === "todas" || s.category === filter) && (purpose === "todas" || s.purpose === purpose));
  const skills = sortSkills(visible, sort);
  const hiddenCount = data.skills.filter((s) => s.hidden).length;
  const maxCat = Math.max(1, ...Object.values(data.categories));

  return (
    <div className="grid gap-4">
      <Panel title={t("skills.categoryUsage")}>
        <div className="grid gap-1 min-w-0">
          {Object.entries(data.categories).sort((a, b) => b[1] - a[1]).map(([c, n]) => (
            <div key={c} className="flex items-center gap-2 text-xs">
              <span className="w-20 text-term-muted">{categoryLabel(c)}</span>
              <div className="flex-1 bg-term-bg rounded-full h-3 overflow-hidden">
                <div className="h-full bg-term-amber" style={{ width: `${(n / maxCat) * 100}%` }} />
              </div>
              <span className="w-8 text-right">{n}</span>
            </div>
          ))}
          {Object.keys(data.categories).length === 0 && <Empty />}
        </div>
      </Panel>

      <div className="flex gap-2 flex-wrap items-center">
        {cats.map((c) => (
          <button type="button" key={c} onClick={() => setFilter(c)} className={`chip ${filter === c ? "active" : ""}`}>
            {c === "todas" ? t("skills.all") : categoryLabel(c)}
          </button>
        ))}
        <span className="text-term-muted">·</span>
        {purposes.map((p) => (
          <button type="button" key={p} onClick={() => setPurpose(p)} className={`chip ${purpose === p ? "active" : ""}`}>
            {p === "todas" ? t("skills.all") : purposeLabel(p)}
          </button>
        ))}
        <span className="flex-1" />
        {hiddenCount > 0 && (
          <label className="text-xs text-term-muted flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
            {t("skills.showHidden", { count: hiddenCount })}
          </label>
        )}
        <label className="text-xs text-term-muted flex items-center gap-1">
          {t("skills.sort")}
          <select value={sort} onChange={(e) => setSort(e.target.value as (typeof SORTS)[number])} className="chip">
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t(SORT_LABEL_KEYS[s])}
              </option>
            ))}
          </select>
        </label>
      </div>

      {msg && <div className="text-xs text-term-amber">{msg}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {skills.map((s) => (
          <div key={s.name} className={`card2 p-3 ${s.uses === 0 ? "opacity-40" : ""} ${s.hidden ? "opacity-30" : ""}`}>
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-term-amber font-bold truncate">/{s.name}</span>
              <span className="text-xs text-term-muted shrink-0">{categoryLabel(s.category)}</span>
            </div>
            {s.description && <p className="text-xs text-term-muted mt-1 truncate">{s.description}</p>}
            <div className="flex items-center gap-2 mt-2 text-xs">
              <select
                value={s.purposeSource === "manual" ? s.purpose : "auto"}
                onChange={(e) => void mutate(`/api/skills/${encodeURIComponent(s.name)}/meta`, "PUT", { tag: e.target.value === "auto" ? null : e.target.value })}
                className="chip"
                title={s.purposeSource === "manual" ? t("skills.manualTag") : t("skills.autoTag", { source: purposeSourceLabel(s.purposeSource) })}
              >
                <option value="auto">{t("skills.auto", { purpose: purposeLabel(s.purpose) })}</option>
                {PURPOSE_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {purposeLabel(p)}
                  </option>
                ))}
              </select>
              <button type="button" className="chip" onClick={() => void mutate(`/api/skills/${encodeURIComponent(s.name)}/meta`, "PUT", { pinned: !s.pinned })}>
                {s.pinned ? t("skills.unpin") : t("skills.pin")}
              </button>
              <button type="button" className="chip" onClick={() => void mutate(`/api/skills/${encodeURIComponent(s.name)}/meta`, "PUT", { hidden: !s.hidden })}>
                {s.hidden ? t("skills.show") : t("skills.hide")}
              </button>
            </div>
            <div className="flex justify-between text-xs mt-2 text-term-muted">
              <span>{s.uses} {t(s.uses === 1 ? "skills.oneUse" : "skills.uses")}</span>
              <span>{s.lastUsed ? formatDate(s.lastUsed, { year: "numeric", month: "short", day: "numeric" }) : t("skills.noUses")}</span>
            </div>
            {s.agents.length > 0 && (
              <div className="mt-2 text-xs text-term-muted">
                <span className="uppercase tracking-wider">{t("skills.byAi")} </span>
                {s.agents.map((a) => `${a.agent} · ${a.uses} ${t(a.uses === 1 ? "skills.oneUse" : "skills.uses")} · ${usd(a.savedUsd)}`).join("  |  ")}
              </div>
            )}
            {s.installedAt.length > 0 && (
              <div className="mt-1 text-xs text-term-muted grid gap-0.5">
                {s.installedAt.map((l) => (
                  <div key={`${l.agent}:${l.path}`} className="truncate">
                    <span className="text-term-green">{l.agent}</span> {l.path}
                    {l.target !== l.path && <span> → {l.target}</span>}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between items-center mt-1">
              <span className="text-term-green text-sm">{usd(s.savedUsd)} {t("skills.saved")}</span>
              {s.installedAt.length > 0 && (
                <button type="button" className="text-xs text-term-muted hover:text-term-amber" onClick={() => uninstall(s)}>
                  {t("skills.uninstall")}
                </button>
              )}
            </div>
          </div>
        ))}
        {skills.length === 0 && <Empty />}
      </div>
    </div>
  );
}
