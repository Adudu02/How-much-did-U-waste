## Why

DFT's measurement engine (`packages/core`) is ~90% generic (ingest pipeline, metrics DB with migrations, pricing engine, cost math, derived views), but it cannot be dropped into another project because `src/adapters/registry.ts` statically imports the 10 coding-agent adapters and `ingestAll` hardcodes them. Extracting the engine as a standalone package with a pluggable adapter registry makes the whole measurement machinery reusable in any project, while DFT becomes just one consumer of it.

## What Changes

> **Alcance reducido por decisión del usuario**: la rama `feat/extract-core` NO se
> fusiona con main — es una línea de feature independiente. DFT queda intacto
> (packages/core, insights, root y pipelines idénticos a main) y la rama aporta
> SOLO la extracción como paquetes aditivos.

- **New package `packages/engine`** (npm `agent-usage-engine`): the generic measurement engine. Contains the normalized event model, `IngestAdapter`/`SyncAdapter` interfaces, the incremental ingest pipeline, metrics DB (schema + migrations), pricing engine + updaters, cost math, aggregate/summary/activity/export/report views, quota framework (types, cache, refresh runner — no probers), read-only IO + SQLite snapshot helpers, and `setDataDir` injection. `ingestAll` accepts adapter lists as parameters — **the engine knows zero agents**.
- **New package `packages/adapters`** (npm `agent-usage-adapters`): the coding-agent adapter pack. The 10 existing adapters (Claude Code, Codex, Qwen, ZCode, Gemini, OpenCode, Grok, Goose, Amp, Crush), the 6 quota probers + `ALL_PROBERS`, `getIngestAdapters`/`getSyncAdapters`/`rootsFromConfig` with their default roots and test-isolation rules, y `refreshQuota` con defaults del pack.
- **DFT NO cambia**: `packages/core` conserva su implementación actual (la extracción es aditiva: los archivos viven en ambos lados hasta que la rama tenga su propio ciclo de vida). Sin facade, sin wiring de build/release en main, sin cambios en insights.

## Capabilities

### New Capabilities

- `usage-engine`: the standalone generic engine library — zero agent knowledge, injectable adapter registries, public API barrel, injectable data root, generic config-store helper.
- `agent-adapters-pack`: the separately packaged set of coding-agent adapters + quota probers with default roots, test-isolation rules and `config.agentPaths` translation.

### Modified Capabilities

(none — DFT behavior is untouched; `agent-usage-ingestion` on main stays as-is)

## Impact

- **New code (additive only)**: `packages/engine/src/**` + `packages/engine/test/**` + `packages/engine/data/*`, `packages/adapters/src/**` + `packages/adapters/test/**`; lockfile entries for the two workspace packages.
- **Unchanged**: `packages/core`, `packages/insights`, `packages/reporter`, `src/`, `web/`, `bin/`, `scripts/`, `.github/`, `tsconfig.json`, `vitest.config.ts`, root `package.json` — byte-identical to `main` (`git diff main -- <those paths>` is empty).
- **Duplication is deliberate**: until the branch becomes its own repo/product, the extracted files also remain in `packages/core`; DFT's release pipeline is untouched.
- **Invariants preserved in the extracted packages**: sources read-only, prompts never persisted, state under `data/`, WAL snapshot helper.
