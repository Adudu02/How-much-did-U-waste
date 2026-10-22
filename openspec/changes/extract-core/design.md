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

### D2: `ingestAll` del motor recibe adapters; la composición vive en el consumidor

Motor: `ingestAll(db, { adapters: IngestAdapter[], syncAdapters: SyncAdapter[], pricing?, staleDays?, timeZone?, reparseSkills? })` — listas vacías por defecto (no-op). Sin facade: cada consumidor compone raíces → registry del pack → motor (el pack lo documenta y su test helper `test/helpers.ts` es la referencia de esa composición).
*Alternativa descartada*: que el motor conserve defaults de raíces — reintroduciría conocimiento de agentes en el motor.

### D3: DFT queda intacto — extracción aditiva, sin facade

**Decisión de usuario**: la rama no se fusiona con main, es una línea de feature independiente. Por eso NO se toca `packages/core` (sin facade), `packages/insights` (sin reescribir config) ni el wiring de build/release del root: `git diff main -- packages/core packages/insights src web scripts .github tsconfig.json vitest.config.ts package.json` es vacío. Los archivos extraídos permanecen duplicados en core hasta que la rama tenga su propio ciclo de vida (repo propio o publicación).
*Alternativa descartada (implementada primero y revertida)*: core como facade re-exportando engine+adapters con wrappers de `ingestAll`/`refreshQuota` — API pública estable pero acopla el ciclo de vida de DFT al de la extracción, y la rama habría llevado cambios de DFT que nunca se fusionarían.

### D4: config store genérico en engine

Engine expone `createConfigStore` con la maquinaria de config de insights: load con defaults, allowlist de claves (reject unknown), merge parcial dirigido por schema del consumidor, save atómico (tmp+rename). El schema DFT NO migra (insights queda intacto); el store queda disponible para cualquier proyecto sobre el engine.
*Alternativa descartada*: mover config completo a engine con el schema DFT — contaminaría el motor con opiniones del producto.

### D5: nombres npm neutros, wiring mínimo

`agent-usage-engine` y `agent-usage-adapters` (carpetas `packages/engine`, `packages/adapters`). `pnpm-workspace.yaml` ya cubre `packages/*` — única concesión del root. Cada paquete se construye/prueba con `pnpm --filter <pkg> build|test`; los scripts del root NO cambian. Publicar a npm / tarballs queda fuera de alcance (decisión posterior).
*Alternativa descartada*: un solo paquete con subpath exports (`@engine/adapters`) — el pack de adapters debe ser excluíble para que cualquier proyecto use el motor a secas.

### D6: cero migración de datos

El schema de DB, `data/motor.db`, `data/pricing.json`, offsets y reports no cambian; `setDataDir` sigue siendo la única fuente de verdad de rutas. Un proyecto externo que hoy usa core no nota nada; uno nuevo usa engine a secas con su propio data dir.

## Risks / Trade-offs

- [Duplicación deliberada con `packages/core`] → mientras la rama viva sin fusionarse, los archivos extraídos existen en ambos lados y pueden divergir; mitigación: la rama puede absorber main (`git merge main`) sin conflicto de dirección, y el paso final (repo propio o publicación) elimina la copia de DFT.
- [`better-sqlite3` en engine duplica builds nativos] → ya está allowlistado en `pnpm-workspace.yaml`; engine es su único runtime dep, igual que core hoy.
- [Riesgo de leakage: engine importando accidentalmente del pack] → regla de dependencia unidireccional validada por el propio layout (engine no declara la dep en package.json) y por sus tests standalone.
- [Publicación npm de nombres nuevos puede colisionar] → verificar disponibilidad cuando se decida publicar; por ahora son paquetes internal-first del workspace.

## Migration Plan

1. Crear `packages/engine` y `packages/adapters` con el código extraído (copias de core, no movimientos) + sus tests/configs propios.
2. Verificar `git diff main` = solo paquetes nuevos + lockfile + artifacts de openspec.
3. Gate por lado: engine/adapters con `pnpm --filter`; DFT con sus scripts de main (typecheck/test/build) intactos.
4. Rollback: eliminar la rama — main jamás fue tocado; ningún dato migra.
