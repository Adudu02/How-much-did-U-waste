import { useLocale } from "../i18n.js";

export const Empty = ({ msg }: { msg?: string }) => {
  const { t } = useLocale();
  return <div className="text-term-muted text-sm">{msg ?? t("empty")}</div>;
};
