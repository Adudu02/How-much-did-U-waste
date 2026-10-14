import { useState } from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { useApi } from "../hooks.js";
import type { WasteReport, WasteFinding } from "../types.js";
import { Panel } from "../components/Panel.js";
import { Loading } from "../components/Loading.js";
import { ErrorMsg } from "../components/ErrorMsg.js";
import { Empty } from "../components/Empty.js";
import { useLocale } from "../i18n.js";

const WASTE_TAG: Record<WasteFinding["kind"], string> = {
  "cache-miss": "CACHE",
  "session-bloat": "BLOAT",
  "model-mismatch": "MODEL",
};

const PAGE_SIZE = 20;

export function Ahorro() {
  const { t, usd, compact, pct, formatDate } = useLocale();
  const { data, error } = useApi<WasteReport>("/api/waste");
  const [visible, setVisible] = useState(PAGE_SIZE);
  if (error) return <ErrorMsg msg={error} />;
  if (!data) return <Loading />;
  const shown = data.findings.slice(0, visible);
  const findingTitle = (f: WasteFinding) => {
    if (f.kind === "cache-miss") return t("savings.cacheTitle", { ratio: Math.round(f.metrics.cacheHitRatio * 100) });
    if (f.kind === "session-bloat") return t("savings.bloatTitle", {
      turns: f.metrics.turns,
      tokens: compact(f.metrics.input + f.metrics.output + f.metrics.cacheWrite + f.metrics.cacheRead),
    });
    return t(f.metrics.turns === 1 ? "savings.mismatchTitleOne" : "savings.mismatchTitle", { turns: f.metrics.turns, model: f.model ?? f.title });
  };
  const findingDetail = (f: WasteFinding) => {
    if (f.kind === "cache-miss") return t("savings.cacheDetail", { tokens: compact(f.metrics.input) });
    if (f.kind === "session-bloat") return t("savings.bloatDetail");
    return t("savings.mismatchDetail", {
      tokens: compact(data.thresholds.trivialOutputTokens),
      target: f.targetModel ?? "—",
    });
  };
  return (
    <div className="grid gap-4">
      <Panel>
        <div className="text-term-muted text-xs uppercase tracking-widest mb-1">{t("savings.estimated")}</div>
        <div className="text-4xl font-bold text-term-green">{usd(data.totalEstUsd)}</div>
        <div className="text-xs text-term-muted mt-1">
          {t(data.findings.length === 1 ? "savings.summaryOne" : "savings.summary", { findings: data.findings.length, tokens: compact(data.totalEstTokens) })}
        </div>
        {data.trend.length > 1 && (
          <div className="h-24 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend.map((p) => ({ day: formatDate(p.day, { month: "numeric", day: "numeric" }), v: p.estUsd }))} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fill: "#9ca3af", fontSize: 10 }} interval="preserveStartEnd" />
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 20px -8px rgba(15,23,42,0.18)", color: "#14161b" }}
                  itemStyle={{ color: "#16a34a" }}
                  labelStyle={{ color: "#6b7280" }}
                  formatter={(v) => typeof v === "number" ? usd(v) : ""}
                />
                <Line type="monotone" dataKey="v" stroke="#16a34a" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="text-xs text-term-muted mt-1">{t("savings.trend")}</div>
      </Panel>
      {data.findings.length === 0 && <Empty msg={t("savings.empty")} />}
      {shown.map((f) => (
        <Panel key={f.kind + f.sessionId}>
          <div className="flex justify-between items-baseline gap-2">
            <span className={`tag2 ${f.estUsd != null ? "bg-term-amber/10 text-term-amber" : "bg-term-border text-term-muted"}`}>
              {WASTE_TAG[f.kind]}
            </span>
            <span className="text-term-green font-bold">{f.estUsd != null ? usd(f.estUsd) : "—"}</span>
          </div>
          <div className="mt-2 text-term-amber">{findingTitle(f)}</div>
          <div className="text-xs text-term-muted mt-1">
            {f.project}/{f.sessionId.slice(0, 8)} · {f.metrics.turns} {t(f.metrics.turns === 1 ? "activity.oneTurn" : "activity.turns")} · {t("savings.cacheHitRatio")} {pct(f.metrics.cacheHitRatio)}
          </div>
          <div className="text-sm mt-2">{findingDetail(f)}</div>
        </Panel>
      ))}
      {visible < data.findings.length && (
        <button type="button" className="btn justify-self-start" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
          {t("savings.loadMore", { count: data.findings.length - visible })}
        </button>
      )}
    </div>
  );
}
