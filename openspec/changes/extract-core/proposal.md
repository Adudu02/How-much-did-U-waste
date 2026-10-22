## Why

DFT's measurement engine (`packages/core`) is ~90% generic (ingest pipeline, metrics DB with migrations, pricing engine, cost math, derived views), but it cannot be dropped into another project because `src/adapters/registry.ts` statically imports the 10 coding-agent adapters and `ingestAll` hardcodes them. Extracting the engine as a standalone package with a pluggable adapter registry makes the whole measurement machinery reusable in any project, while DFT becomes just one consumer of it.

## What Changes

- **New package `packages/engine`** (npm `agent-usage-engine`): the generic measurement engine. Contains the normalized event model, `IngestAdapter`/`SyncAdapter` interfaces, the incremental ingest pipeline, metrics DB (schema + migrations), pricing engine + updaters, cost math, aggregate/summary/activity/export/report views, quota framework (types, cache, refresh runner — no probers), read-only IO + SQLite snapshot helpers, and `setDataDir` injection. `ingestAll` accepts adapter lists as parameters — **the engine knows zero agents**.
- **New package `packages/adapters`** (npm `agent-usage-adapters`): the coding-agent adapter pack. The 10 existing adapters (Claude Code, Codex, Qwen, ZCode, Gemini, OpenCode, Grok, Goose, Amp, Crush), the 6 quota probers, `getIngestAdapters`/`getSyncAdapters`/`rootsFromConfig` with their default roots and test-isolation rules.
- **`packages/core` becomes a facade** re-exporting engine + adapters and wrapping `ingestAll` with the pack's registry, so the public API of `how-much-did-u-waste-core` is unchanged (insights, reporter, root app and published-npm consumers keep working without edits).
- **Generic config-store pattern extracted to engine**: schema-driven load/validate/atomic-save with allowlist keys and partial updates (the machinery currently inside `packages/insights/src/config.ts`); insights keeps its DFT schema but uses the generic store.
- Build/lint/test/release wiring for the two new packages; adapter tests move to the adapters pack.

## Capabilities

### New Capabilities

- `usage-engine`: the standalone generic engine library — zero agent knowledge, injectable adapter registries, public API barrel, injectable data root, generic config-store helper.
- `agent-adapters-pack`: the separately packaged set of coding-agent adapters + quota probers with default roots, test-isolation rules and `config.agentPaths` translation.

### Modified Capabilities

- `agent-usage-ingestion`: `ingestAll` SHALL accept injected adapter lists (pluggable registry) instead of building them internally; the built-in registry requirements (default roots, test isolation, `rootsFromConfig` coverage) relocate to `agent-adapters-pack` and are re-stated there. Ingest behavior (dedup, offsets, transactions, cost materialization) is unchanged.

## Impact

- **New code**: `packages/engine/src/**` (moved from `packages/core/src` minus adapters/probers), `packages/adapters/src/**` (moved adapters + probers + registry).
- **Modified**: `packages/core/src/index.ts` (facade barrel), `packages/core/package.json` (depends on both new packages), root `package.json` scripts (`build:engine`, `build:adapters`, test chain), `biome.json` lint paths, `.github/workflows/release.yml` and `scripts/pack-release.mjs` if publishing the new packages.
- **Moved tests**: adapter-specific tests (`agent-coverage`, `codex`, `gemini`, `zcode`, `sqlite-adapters`, `registry`) → `packages/adapters/test/`; engine tests stay in `packages/engine/test/`.
- **Unchanged behavior**: ingest semantics, DB schema/versioning, pricing precedence/units, quota probing, all API routes, dashboard. `how-much-did-u-waste-core` public API stays source-compatible.
- **Invariants preserved**: sources read-only, prompts never persisted, state under `data/`, WAL snapshot helper, 127.0.0.1 binding.
