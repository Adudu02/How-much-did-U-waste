import { useLocale } from "../i18n.js";

export const ErrorMsg = ({ msg }: { msg: string }) => {
  const { t, localizeError } = useLocale();
  return <div className="text-term-red text-sm">{t("error.prefix")} {localizeError(msg)}</div>;
};
