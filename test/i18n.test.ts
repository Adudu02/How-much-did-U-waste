import { describe, expect, it } from "vitest";
import { persistLocalePreference, readLocalePreference, resolveLocale, translate } from "../web/src/i18n-messages.js";

describe("UI locale messages", () => {
  it("defaults invalid or missing preferences to Spanish", () => {
    expect(resolveLocale(null)).toBe("es-MX");
    expect(resolveLocale("fr-FR")).toBe("es-MX");
    expect(resolveLocale("en-US")).toBe("en-US");
  });

  it("persists the selected language and tolerates unavailable storage", () => {
    const values = new Map<string, string>();
    persistLocalePreference((key, value) => values.set(key, value), "en-US");
    expect(readLocalePreference(() => values.get("dft.language") ?? null)).toBe("en-US");
    expect(readLocalePreference(() => { throw new Error("storage unavailable"); })).toBe("es-MX");
    expect(() => persistLocalePreference(() => { throw new Error("storage unavailable"); }, "en-US")).not.toThrow();
  });

  it("translates and interpolates app-authored messages", () => {
    expect(translate("en-US", "home.apiSpend", { days: 28 })).toBe("API-equivalent spend · 28d");
    expect(translate("es-MX", "home.unknownModels", { count: 2 })).toBe("2 modelos sin tarifa (costo 0)");
  });
});
