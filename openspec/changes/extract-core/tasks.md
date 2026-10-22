## 0. Alcance

> **Re-scoped por decisión del usuario**: la rama NO se fusiona con main y DFT
> queda intacto. Se descartaron las tareas originales de facade de core (4.x),
> reescritura de config de insights (5.1) y wiring de root/release (6.1–6.2);
> abajo queda solo la extracción aditiva.

## 1. Scaffold de paquetes

- [x] 1.1 Crear `packages/engine` (npm `agent-usage-engine`) con package.json (export `.` a `dist/index.js`, única dep runtime `better-sqlite3`, engines >=20), tsconfig, vitest.config
- [x] 1.2 Crear `packages/adapters` (npm `agent-usage-adapters`) con package.json (dep `agent-usage-engine` workspace), tsconfig, vitest.config; verificar que `pnpm install` resuelve el workspace

## 2. Motor genérico (engine)

- [x] 2.1 Extraer a `packages/engine/src`: `ingest.ts`, `lib/*`, `adapters/types.ts` y las interfaces `IngestAdapter`/`SyncAdapter` en `src/adapters/contracts.ts`; barrel `src/index.ts` sin exports de agentes; verificar `pnpm --filter agent-usage-engine build`
- [x] 2.2 `ingestAll` recibe `adapters: IngestAdapter[]` y `syncAdapters: SyncAdapter[]` (default `[]`); test nuevo de ingesta no-op con listas vacías + pipeline con adapter fake
- [x] 2.3 Framework de quota (`types`, `cache`, `refresh`, contrato `QuotaProber` + `runQuotaProbers`) sin probers concretos; test con registry fake
- [x] 2.4 `createConfigStore` genérico (defaults + validate allowlist + merge parcial + save atómico tmp+rename) en `src/lib/config-store.ts` con tests propios; exportado desde el barrel

## 3. Pack de adapters

- [x] 3.1 Los 10 adapters + 6 probers + `ALL_PROBERS` + `getIngestAdapters`/`getSyncAdapters`/`rootsFromConfig` (raíces por defecto y regla de aislamiento) en `packages/adapters/src`; barrel; `refreshQuota` con defaults del pack; verificar `pnpm --filter agent-usage-adapters build`
- [x] 3.2 Tests del pack (adapters, registry, cobertura, quota-probers, ingesta end-to-end vía helper `test/helpers.ts` + setup con pricing sembrado); verificar `pnpm --filter agent-usage-adapters test`

## 4. DFT intacto

- [x] 4.1 Verificar `git diff main -- packages/core packages/insights packages/reporter src web scripts bin .github tsconfig.json vitest.config.ts package.json` vacío (extracción aditiva: sin facade, sin cambios en insights, sin wiring de root)
- [x] 4.2 Gate de DFT con los scripts de main: `pnpm typecheck && pnpm test && pnpm run build` en verde (256 tests)

## 5. Validación de la extracción

- [x] 5.1 Gate standalone de los paquetes nuevos: `pnpm --filter agent-usage-engine build && test` (68) y `pnpm --filter agent-usage-adapters build && test` (124) en verde; diff vs main limitado a `packages/engine`, `packages/adapters`, `pnpm-lock.yaml` y artifacts de openspec
