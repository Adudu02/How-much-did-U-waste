## 1. Scaffold de paquetes

- [x] 1.1 Crear `packages/engine` (npm `agent-usage-engine`) con package.json (export `.` a `dist/index.js`, única dep runtime `better-sqlite3`, engines >=20), tsconfig, vitest.config copiados de `packages/core`
- [x] 1.2 Crear `packages/adapters` (npm `agent-usage-adapters`) con package.json (dep `agent-usage-engine` workspace), tsconfig, vitest.config; verificar que `pnpm install` resuelve el workspace

## 2. Motor genérico (engine)

- [x] 2.1 Mover (git mv) a `packages/engine/src`: `ingest.ts`, `lib/*`, `adapters/types.ts`, y de `registry.ts` solo las interfaces `IngestAdapter`/`SyncAdapter` a `src/adapters/contracts.ts`; crear barrel `src/index.ts` sin exports de agentes; verificar `pnpm --filter agent-usage-engine build`
- [x] 2.2 Cambiar `ingestAll` para recibir `adapters: IngestAdapter[]` y `syncAdapters: SyncAdapter[]` (default `[]`); mover los overrides de raíces fuera del motor; verificar que un test nuevo de ingesta no-op con listas vacías pasa
- [x] 2.3 Mover `quota/{types,cache,refresh}.ts` y el contrato `QuotaProber` (sin `probers/*`) a engine; verificar build y que `runQuotaProbers` acepta un registry inyectado (test existente de quota adaptado)
- [x] 2.4 Extraer `createConfigStore({ path, schema, defaults })` genérico desde `packages/insights/src/config.ts` (load con defaults, allowlist, merge parcial, save atómico tmp+rename) a `packages/engine/src/lib/config-store.ts` con tests propios (clave desconocida rechazada, guardado atómico); exportar desde el barrel

## 3. Pack de adapters

- [x] 3.1 Mover (git mv) los 10 adapters, `quota/probers/*` + `ALL_PROBERS`, `getIngestAdapters`/`getSyncAdapters`/`rootsFromConfig` (con raíces por defecto y regla de aislamiento) a `packages/adapters/src`; barrel `src/index.ts`; verificar `pnpm --filter agent-usage-adapters build`
- [x] 3.2 Mover los tests de agentes (`agent-coverage`, `codex`, `gemini`, `zcode`, `sqlite-adapters`, `registry`, `qwen-integration`, fixtures) a `packages/adapters/test`; verificar `pnpm --filter agent-usage-adapters test`

## 4. Facade de core

- [x] 4.1 Reducir `packages/core/src` a un facade: `src/index.ts` re-exporta engine + adapters (types con `export type`) y expone `ingestAll` wrapper con la firma actual que compone raíces → `getIngestAdapters`/`getSyncAdapters` → `ingestAll` del motor; package.json de core pasa a depender de ambos paquetes workspace
- [x] 4.2 Dejar en `packages/core/test` un smoke del facade (barrel exporta la API pública actual + wrapper ingiere fixture Claude end-to-end); verificar `pnpm --filter how-much-did-u-waste-core test`

## 5. Insights sobre el config store genérico

- [x] 5.1 Reescribir `packages/insights/src/config.ts` como schema DFT + delegate en `createConfigStore`, manteniendo la firma y errores de `validateConfig`; verificar que los tests de insights (`waste`, `skills`, `pricing-auto`) pasan sin cambios

## 6. Wiring y gate

- [x] 6.1 Root `package.json`: agregar `build:engine`/`build:adapters` antes de `build:core` en `build` y `test`; agregar rutas nuevas a `lint` (biome); actualizar `tsconfig.json` paths/references si aplica
- [x] 6.2 Agregar `agent-usage-engine` y `agent-usage-adapters` a `.github/workflows/release.yml` y a `bundledDependencies` de `scripts/pack-release.mjs`; verificar `node scripts/pack-release.mjs` genera los tarballs
- [x] 6.3 Gate completo: `pnpm lint && pnpm typecheck && pnpm test && pnpm run build` en verde
- [x] 6.4 Validación runtime: `./start.sh --update`, levantar el server, verificar `/api/health` y `/api/summary` responden, y detener el server de prueba; confirmar que `data/` existente no cambia (hash de `motor.db` antes/después de una ingesta incremental)
