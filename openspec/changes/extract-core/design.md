## Context

El repo ya tuvo una extracción previa (era "Motor Agéntico", se re-marcó a `how-much-did-u-waste-*`) y conserva las costuras: `setDataDir` (raíz de estado inyectable, `packages/core/src/lib/paths.ts`), barrels públicos por paquete, `ServerOptions` con DI completa y un segundo consumidor headless (`packages/reporter`). El único acoplamiento real al resto del mundo está en `packages/core/src/adapters/registry.ts` (imports estáticos de los 10 adapters + raíces por defecto) y en `ingestAll` (`packages/core/src/ingest.ts:148`), que construye el registry internamente. Los probers de quota ya siguen el patrón inyectable (`runQuotaProbers(probers, ...)`), y la validación de config vive en `packages/insights/src/config.ts` con schema DFT hardcodeado. El schema de DB es un caché reconstruible (`data/motor.db`, WAL), y `packages/insights` ya demostró el precedente de que un paquete downstream cree sus propias tablas (`memory_nodes`).

## Goals / Non-Goals

**Goals:**

- Dos paquetes nuevos publicables: `packages/engine` (npm `agent-usage-engine`, genérico, cero agentes) y `packages/adapters` (npm `agent-usage-adapters`, el pack de los 10 agents + 6 probers).
- API pública de `how-much-did-u-waste-core` 100% source-compatible vía facade: insights, reporter, app root y consumidores npm no cambian.
- Semántica de ingesta, schema de DB, pricing, quota y rutas de estado idénticas (los tests actuales deben pasar con movimientos mínimos).
- Helper de config genérico (schema-driven) en engine; insights lo usa con su schema existente.

**Non-Goals:**

- Cambiar comportamiento observable de DFT (rutas API, UI, CLI, reportes).
- Extraer waste/skills/memory de insights (siguen DFT-only).
- Extraer el server Fastify o el shell web (quedan como referencia en el app root).
- Publicar efectivamente en npm (se deja el wiring listo en release.yml; publicar es decisión aparte).

## Decisions

### D1: mover código, no reescribir — `engine` = core menos adapters/probers

`packages/engine/src` recibe `ingest.ts`, `lib/*`, `adapters/types.ts`, `adapters/registry.ts` (solo interfaces `IngestAdapter`/`SyncAdapter` + tipos), y `quota/{types,cache,refresh}.ts` + contrato `QuotaProber` (sin `probers/*`). `packages/adapters/src` recibe los 10 adapters, `quota/probers/*` + `ALL_PROBERS`, `getIngestAdapters`/`getSyncAdapters`/`rootsFromConfig` con las raíces por defecto y la regla de aislamiento.
*Alternativa descartada*: reescribir el pipeline con un sistema de plugins formal (register/extend) — sobre-ingeniería: el patrón probers (lista pasada como parámetro) ya es el estilo del repo y cubre el caso "cualquier proyecto inyecta sus adapters".

### D2: `ingestAll` del motor recibe adapters; el facade de core los inyecta

Motor: `ingestAll(db, { adapters: IngestAdapter[], syncAdapters: SyncAdapter[], pricing?, staleDays?, timeZone?, reparseSkills? })` — listas vacías por defecto (no-op). Core facade exporta un `ingestAll` con la firma actual (`projectsRoot`, `codexRoot`, …) que compone `rootsFromConfig`-style roots → `getIngestAdapters`/`getSyncAdapters` del pack → motor. Así la firma pública de core no cambia y el motor queda puro.
*Alternativa descartada*: que el motor conserve defaults de raíces — reintroduciría conocimiento de agentes en el motor.

### D3: `packages/core` queda como facade delgado, no se elimina

`how-much-did-u-waste-core` pasa a depender de `agent-usage-engine` + `agent-usage-adapters` y su `src/index.ts` re-exporta ambos más el `ingestAll` wrapper. Sus tests de integración (los que hoy ejercitan adapters end-to-end) se mueven al pack; los de motor se mueven a engine. Publicar 4 paquetes como hoy (el facade no agrega código, solo estabilidad de API).
*Alternativa descartada*: actualizar insights/reporter/root para importar de engine+adapters directamente — rompe consumidores npm existentes de `how-much-did-u-waste-core` y multiplica el churn sin beneficio.

### D4: config store genérico en engine, schema DFT en insights

Engine expone `createConfigStore({ path, schema, defaults })` con la maquinaria actual de `insights/src/config.ts`: load con defaults, allowlist de claves (reject unknown), merge parcial, save atómico (tmp+rename). `insights/src/config.ts` se reescribe como schema DFT + delegate en el store genérico; `validateConfig` mantiene su firma y errores (tests de config pasan sin cambio).
*Alternativa descartada*: mover config completo a engine con el schema DFT — contaminaría el motor con opiniones del producto.

### D5: nombres npm neutros y wiring de build/release

`agent-usage-engine` y `agent-usage-adapters` (carpetas `packages/engine`, `packages/adapters`). `pnpm-workspace.yaml` ya cubre `packages/*`. Root `package.json` agrega `build:engine`/`build:adapters` antes de `build:core`; `lint` agrega las rutas nuevas; `release.yml` publica los dos paquetes nuevos; `pack-release.mjs` los agrega como bundledDependencies del tarball. Los tests se reparten: engine (unit de pricing/db/ingest con adapters fake), adapters (los tests de agentes actuales), core (smoke del facade: barrel + wrapper).
*Alternativa descartada*: mantener todo en un solo paquete con subpath exports (`@engine/adapters`) — el pack de adapters debe ser excluíble para que cualquier proyecto use el motor a secas.

### D6: cero migración de datos

El schema de DB, `data/motor.db`, `data/pricing.json`, offsets y reports no cambian; `setDataDir` sigue siendo la única fuente de verdad de rutas. Un proyecto externo que hoy usa core no nota nada; uno nuevo usa engine a secas con su propio data dir.

## Risks / Trade-offs

- [Duplicación momentánea de tests al mover] → mover, no copiar: cada test se elimina de su ubicación original en el mismo commit; el gate completo (`pnpm lint && pnpm typecheck && pnpm test && pnpm run build`) valida la cadena.
- [`better-sqlite3` en engine duplica builds nativos] → ya está allowlistado en `pnpm-workspace.yaml`; engine es su único runtime dep, igual que core hoy.
- [Facade con re-exports puede perder tipos en `strict`] → `export type *` explícito en el barrel del facade + `pnpm typecheck` gate.
- [Riesgo de leakage: engine importando accidentalmente del pack] → regla de dependencia unidireccional validada por test de integridad (grep de imports en engine) y por el propio layout (engine no declara la dep en package.json).
- [Publicación npm de nombres nuevos puede colisionar] → verificar disponibilidad antes del release; los nombres son internal-first (workspace), publicar es opt-in.

## Migration Plan

1. Crear `packages/engine` y `packages/adapters` moviendo código (git mv) — core compila contra ellos.
2. Core → facade; insights/reporter/root sin cambios de import.
3. Mover tests; agregar test de no-op y test de adapter fake en engine; smoke de facade en core.
4. Wiring build/lint/release; gate completo + `./start.sh --update` para validar runtime.
5. Rollback: revert del merge — ningún dato migra, `data/` es intacto; el branch `feat/extract-core` aísla el cambio.
