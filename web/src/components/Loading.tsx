import { useLocale } from "../i18n.js";

export const Loading = () => {
  const { t } = useLocale();
  return <div className="text-term-muted text-sm animate-pulse">{t("loading")}</div>;
};
