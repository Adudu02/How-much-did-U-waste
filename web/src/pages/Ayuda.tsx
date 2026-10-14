import { Panel } from "../components/Panel.js";
import { useLocale } from "../i18n.js";

export function Ayuda() {
  const { t } = useLocale();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title={t("help.connectAgents")}>
        <p className="text-sm text-term-muted mb-3">
          {t("help.intro")}
        </p>
        <ol className="text-sm space-y-2 list-decimal ml-4">
          <li>
            <span className="text-term-amber">{t("help.autoTitle")}</span> {t("help.autoText")}
            <ul className="ml-4 mt-1 text-term-muted list-disc">
              <li>Claude Code → <code>~/.claude/projects{/**/}*.jsonl</code></li>
              <li>Codex → <code>~/.codex/sessions/**</code> {t("help.and")} <code>archived_sessions/</code></li>
              <li>Qwen → <code>~/.qwen/usage/token-usage-*.jsonl</code></li>
            </ul>
          </li>
          <li>
            <span className="text-term-amber">{t("help.otherPathTitle")}</span> {t("help.otherPathText")}
          </li>
          <li>
            <span className="text-term-amber">{t("help.noPriceTitle")}</span> {t("help.noPriceText")}
          </li>
        </ol>
      </Panel>

      <Panel title={t("help.security")}>
        <p className="text-sm text-term-muted mb-3">
          {t("help.securityIntro")}
        </p>
        <ul className="text-sm space-y-2">
          <li>
            {t("help.noKeys")}
          </li>
          <li>
            {t("help.sourcesIntact")}
          </li>
          <li>
            {t("help.readOnlySources")}
          </li>
          <li>
            {t("help.metricsOnly")}
          </li>
          <li>
            {t("help.loopbackOnly")}
          </li>
        </ul>
        <p className="text-xs text-term-muted mt-3">
          {t("help.pricingNote")}
        </p>
      </Panel>
    </div>
  );
}
