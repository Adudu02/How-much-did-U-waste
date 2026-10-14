## Context

The React dashboard has seven pages and shared components. UI copy is currently embedded in JSX and handlers; there is no locale state or translation dependency. Browser-local storage is sufficient for this local-first, single-browser preference and avoids changing the server config contract.

## Goals / Non-Goals

**Goals:** Provide Spanish and English (US) catalogs, immediate language switching, persistence across reloads, and localized app-authored copy and formatting.

**Non-Goals:** Translating prompts, paths, provider/model IDs, skill names/descriptions, or changing CLI output and server API response shapes.

## Decisions

- Keep a small typed translation catalog in the web app instead of adding a localization dependency; the fixed two-language scope does not need pluralization infrastructure.
- Put locale state in a React provider around the dashboard and expose a translation/formatting hook so shell and page copy update together.
- Save the locale in `localStorage`; invalid or absent values resolve to Spanish. This matches the browser-local dashboard experience without expanding persisted project configuration.
- Keep USD currency formatting explicit and use `es-MX` and `en-US` for locale-sensitive date and number output.
- Render waste recommendation copy from its existing finding kind and metrics in the UI. Add the model and downgrade target as optional structured fields on model-mismatch findings instead of parsing presentation text; the addition remains backward-compatible and leaves existing response fields intact.

## Risks / Trade-offs

- [Risk] English phrasing may be longer and wrap differently → Review all pages in both locales at desktop and narrow widths.
- [Risk] Future UI copy can bypass the catalog → Keep translation keys typed and cover the main navigation and page states in a localization test.
- [Risk] Browser-local preference does not follow the user to a different browser profile → This is intentional; a cross-device preference would require a server setting.
