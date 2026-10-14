## Why

The Inicio dashboard shows which models were used and their estimated usage cost, but not the configured API rate behind each model. Showing the rate beside the models in the selected activity window makes the cost basis visible without leaving the main dashboard.

## What Changes

- Add each active model's configured input and output rates, in USD per 1M tokens, to the main dashboard's model section.
- Resolve rates using the existing pricing lookup, including provider prefixes and dated model identifiers; show models with no matching rate as unknown.
- Use the currently configured pricing data, including the selected source and local overrides.

## Capabilities

### New Capabilities
- `dashboard-model-prices`: Show configured model rates for models present in the dashboard activity window.

### Modified Capabilities

## Impact

- Extend the dashboard summary model data and its API type with optional model rates.
- Update the Inicio model section to display rates from the existing summary response.
- Reuse the core pricing lookup and existing pricing data; no new dependency or pricing source is introduced.
