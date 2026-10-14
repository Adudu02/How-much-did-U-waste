import { useState } from "react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { useApi } from "../hooks.js";
import { CHART_COLORS } from "../constants.js";
import type { Summary } from "../types.js";
import { Panel } from "../components/Panel.js";
import { Loading } from "../components/Loading.js";
import { ErrorMsg } from "../components/ErrorMsg.js";
import { Empty } from "../components/Empty.js";
import { QuotaSection } from "../components/QuotaSection.js";
import { useLocale } from "../i18n.js";

export function Inicio() {
  const { t, usd, compact, pct, formatDate } = useLocale();
  const { data, error } = useApi<Summary>("/api/summary");
  const [mode, setMode] = useState<"subs" | "tokens">("subs");
  const [agentSel, setAgentSel] = useState<string>("todos");
  if (error) return <ErrorMsg msg={error} />;
  if (!data) return <Loading />;
  const s = data;
  const spark = s.daily.map((d) => ({ day: formatDate(d.day, { month: "numeric", day: "numeric" }), v: mode === "subs" ? d.costUsd : d.input + d.output }));
  const agents = s.perAgent.map((a) => a.agent);
  const donutSrc = agentSel === "todos" ? s.perModel : (s.perAgentModels[agentSel] ?? []);
  const donut = donutSrc.filter((m) => m.costUsd > 0);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <QuotaSection />
      <Panel className="md:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <span className="text-term-muted text-xs uppercase tracking-widest">
            {mode === "subs" ? t("home.apiSpend", { days: s.windowDays }) : t("home.tokens", { days: s.windowDays })}
          </span>
          <div className="seg2 text-xs">
            <button type="button"
              onClick={() => setMode("subs")}
              className={`seg2-opt ${mode === "subs" ? "active" : ""}`}
            >
              {t("home.subscription")}
            </button>
            <button type="button"
              onClick={() => setMode("tokens")}
              className={`seg2-opt ${mode === "tokens" ? "active" : ""}`}
            >
              {t("home.apiEquivalent")}
            </button>
          </div>
        </div>
        <div className="text-4xl font-bold text-term-amber">
          {mode === "subs" ? usd(s.totalCostUsd) : compact(s.totalTokens)}
        </div>
        <div className="text-term-muted text-xs mt-1">
          {s.from ? formatDate(s.from, { year: "numeric", month: "short", day: "numeric" }) : "—"} → {s.to ? formatDate(s.to, { year: "numeric", month: "short", day: "numeric" }) : "—"} · {t("home.costAtRate")}
        </div>
        <div className="h-24 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fill: "#9ca3af", fontSize: 10 }} interval="preserveStartEnd" />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 20px -8px rgba(15,23,42,0.18)", color: "#14161b" }}
                itemStyle={{ color: "#4c6ef5" }}
                labelStyle={{ color: "#6b7280" }}
                formatter={(v) => typeof v === "number" ? (mode === "subs" ? usd(v) : compact(v)) : ""}
              />
              <Line type="monotone" dataKey="v" stroke="#4c6ef5" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {s.unknownModels.length > 0 && (
          <div className="mt-2 text-xs text-term-red">⚠ {s.unknownModels.length === 1 ? t("home.unknownModelOne") : t("home.unknownModels", { count: s.unknownModels.length })}</div>
        )}
      </Panel>

      <div className="grid gap-4">
        <Panel title={t("home.activity")}>
          <div className="text-3xl font-bold text-term-amber">{s.activity.turns}</div>
          <div className="text-xs text-term-muted">{t("home.totalTurns")}</div>
          <div className="mt-2 flex gap-4 text-xs">
            <span className={s.activity.deltaPct7d != null && s.activity.deltaPct7d < 0 ? "text-term-red" : "text-term-green"}>
              {s.activity.deltaPct7d == null ? "—" : `${s.activity.deltaPct7d >= 0 ? "▲" : "▼"} ${Math.abs(s.activity.deltaPct7d).toFixed(0)}% 7d`}
            </span>
            <span className="text-term-muted">{s.activity.projects} {t(s.activity.projects === 1 ? "home.projectOne" : "home.projects")}</span>
          </div>
        </Panel>
        <Panel title={t("home.streak")}>
          <div className="text-3xl font-bold text-term-green">{s.streakDays}</div>
          <div className="text-xs text-term-muted">{t("home.activeDays")}</div>
        </Panel>
      </div>

      <Panel title={t("home.modelShare")} className="md:col-span-2">
        <div className="grid gap-2">
          {s.perModel.map((m, i) => (
            <div key={m.model} className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className={`flex-1 min-w-0 truncate ${m.known ? "" : "text-term-red"}`}>
                <span className="block truncate">
                  {m.model}
                  {!m.known && ` ·${t("home.noRate")}`}
                </span>
                {m.rate && (
                  <span className="block text-xs text-term-muted">
                    {t("home.input")} {usd(m.rate.input, 6)}
                    {" · "}{t("home.output")} {usd(m.rate.output, 6)}
                    {` ${t("home.perMillionTokens")}`}
                  </span>
                )}
              </span>
              <span className="text-term-muted w-12 text-right">{pct(m.share)}</span>
              <span className="w-20 text-right text-term-amber">
                {mode === "subs" ? usd(m.costUsd) : compact(m.input + m.output + m.cacheWrite + m.cacheRead)}
              </span>
            </div>
          ))}
          {s.perModel.length === 0 && <Empty />}
        </div>
      </Panel>

      <Panel title={t("home.total")}>
        {agents.length > 0 && (
          <div className="seg2 text-xs flex-wrap mb-2 w-fit">
            {["todos", ...agents].map((a) => (
              <button type="button"
                key={a}
                onClick={() => setAgentSel(a)}
                className={`seg2-opt ${agentSel === a ? "active" : ""}`}
              >
                {a === "todos" ? t("home.all") : a}
              </button>
            ))}
          </div>
        )}
        {donut.length > 0 ? (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donut} dataKey="costUsd" nameKey="model" innerRadius={40} outerRadius={65} paddingAngle={2} isAnimationActive={false}>
                  {donut.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="#ffffff" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 20px -8px rgba(15,23,42,0.18)", color: "#14161b" }}
                  itemStyle={{ color: "#4c6ef5" }}
                  labelStyle={{ color: "#6b7280" }}
                  formatter={(v) => typeof v === "number" ? usd(v) : ""}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty />
        )}
      </Panel>

      <Panel title={t("home.agentShare")} className="md:col-span-3">
        <div className="grid gap-2">
          {s.perAgent.map((a, i) => (
            <div key={a.agent} className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="w-28 truncate">{a.agent}</span>
              <div className="flex-1 bg-term-bg rounded-full h-3 overflow-hidden">
                <div className="h-full bg-term-amber" style={{ width: `${a.share * 100}%` }} />
              </div>
              <span className="text-term-muted w-12 text-right">{pct(a.share)}</span>
              <span className="w-20 text-right">{compact(a.tokens)} {t("home.tokensShort")}</span>
              <span className="w-20 text-right text-term-amber">{a.costUsd > 0 ? usd(a.costUsd) : "—"}</span>
            </div>
          ))}
          {s.perAgent.length === 0 && <Empty />}
        </div>
      </Panel>
    </div>
  );
}
