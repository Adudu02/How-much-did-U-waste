## Why

The dashboard currently presents most of its interface in Spanish, which makes it harder for English-speaking users to operate. A user-selectable English (US) locale will make the dashboard usable in English while preserving the current Spanish experience by default.

## What Changes

- Add a Spanish / English (US) language preference in Configuración and persist it in the browser.
- Localize app-authored interface text, including navigation, page content, accessible labels, and generated recommendations/errors.
- Format locale-sensitive dates and numbers for the selected language.
- Preserve model identifiers, provider names, paths, prompts, and other user or source data as-is.

## Capabilities

### New Capabilities
- `ui-localization`: Select and persist the dashboard language, and render app-authored UI text in Spanish or English (US).

### Modified Capabilities

## Impact

- Affects the React dashboard shell, all dashboard pages and shared UI components.
- Adds no dependency or persisted application configuration. Model-mismatch waste findings gain optional model identifiers while retaining all existing response fields.
- Requires a UI localization test and a visual check of both locales.
