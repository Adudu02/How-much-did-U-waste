## Context

The Inicio page receives its model rows from `/api/summary`. The summary is built in core with the current `Pricing` object, while core's `getRate` already resolves exact names, supported provider prefixes, and dated suffixes. The UI's current `known` flag checks only exact keys, so rate display should use the same resolver as cost calculation.

## Goals / Non-Goals

**Goals:**
- Include effective input/output rates for active models in the existing summary response.
- Display the rates in the existing Inicio model section using USD per 1M tokens.
- Keep unknown models visibly without a fabricated or zero price.

**Non-Goals:**
- List models that are absent from the activity window.
- Add pricing sources, refresh controls, per-provider pricing, or new configuration.
- Recalculate already-ingested costs or change pricing update behavior.

## Decisions

- Extend the summary's per-model data with its resolved rate, using the existing pricing resolver. This keeps normalization in core and avoids duplicating lookup rules in React.
- Treat a missing resolved rate as unknown and leave its rate absent/null; do not show `$0` as if it were a real price.
- Render input and output rates alongside active model names in the current model participation panel. Keep the existing window filtering, order, and empty state.
- Preserve the pricing format already used by core: USD per million tokens. The effective pricing object already reflects the configured source, overrides, and preserved local entries.

## Risks / Trade-offs

- [The summary's current exact-key `known` check can disagree with cost calculation for normalized model names] → Derive both the displayed rate and known state from the existing rate resolver.
- [Adding rate details enlarges the existing summary response slightly] → Include only the two scalar rates for models already present in the activity window.

## Migration Plan

No data migration is required. The summary response gains an optional per-model rate field, so older clients can continue ignoring it. Rollback consists of reverting the summary and dashboard changes.
