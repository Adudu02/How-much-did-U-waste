import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { LOCALE_STORAGE_KEY, readLocalePreference, persistLocalePreference, translate, localizeApiError, type Locale, type MessageKey, type MessageValues } from "./i18n-messages.js";
export { resolveLocale, readLocalePreference, persistLocalePreference, translate, localizeApiError } from "./i18n-messages.js";
export type { Locale, MessageKey, MessageValues } from "./i18n-messages.js";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, values?: MessageValues) => string;
  formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  usd: (value: number, maximumFractionDigits?: number) => string;
  compact: (value: number) => string;
  pct: (value: number) => string;
  localizeError: (message: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readLocale(): Locale {
  return readLocalePreference(() => window.localStorage.getItem(LOCALE_STORAGE_KEY));
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readLocale);
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocalePreference((key, value) => window.localStorage.setItem(key, value), next);
  }, []);
  const value = useMemo<LocaleContextValue>(() => {
    const numberFormat = (options?: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale, options);
    const formatDate = (input: string | Date, options?: Intl.DateTimeFormatOptions) => {
      const date = input instanceof Date
        ? input
        : /^\d{4}-\d{2}-\d{2}$/.test(input)
          ? new Date(`${input}T00:00:00`)
          : new Date(input);
      return Number.isNaN(date.getTime()) ? String(input) : new Intl.DateTimeFormat(locale, options).format(date);
    };
    return {
      locale,
      setLocale,
      t: (key, values) => translate(locale, key, values),
      localizeError: (message) => localizeApiError(locale, message),
      formatDate,
      formatNumber: (n, options) => numberFormat(options).format(n),
      usd: (n, maximumFractionDigits = 2) => numberFormat({ style: "currency", currency: "USD", maximumFractionDigits }).format(n ?? 0),
      compact: (n) => n >= 1e6 ? `${numberFormat({ maximumFractionDigits: 1 }).format(n / 1e6)}M` : n >= 1e3 ? `${numberFormat({ maximumFractionDigits: 1 }).format(n / 1e3)}k` : numberFormat().format(n ?? 0),
      pct: (n) => numberFormat({ style: "percent", maximumFractionDigits: 0 }).format(n),
    };
  }, [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside LocaleProvider");
  return value;
}
