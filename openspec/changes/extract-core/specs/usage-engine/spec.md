## Purpose

Define el motor genérico de medición de uso como librería independiente: ingesta incremental, DB de métricas con versionado, motor de pricing, costo equiv-API, vistas derivadas y framework de quota, sin conocimiento de ningún agente concreto y consumible desde cualquier proyecto.

## ADDED Requirements

### Requirement: Motor sin conocimiento de agentes

El paquete del motor SHALL contener únicamente maquinaria genérica: modelo normalizado de eventos, contratos de adapters, pipeline de ingesta, DB de métricas, pricing, costo y vistas derivadas. El motor SHALL NOT importar, referenciar ni registrar adapter o prober alguno de un agente concreto, y SHALL poder consumirse como librería sin servidor, UI ni CLI.

#### Scenario: Ingesta sin adapters es no-op

- **WHEN** `ingestAll` corre con listas de adapters vacías y una DB vacía
- **THEN** termina sin error con resumen en cero y sin crear eventos ni offsets

#### Scenario: Sin dependencias de entrega

- **WHEN** se inspeccionan las dependencias en runtime del paquete del motor
- **THEN** no incluye servidor web, framework de UI ni framework de CLI

### Requirement: Registro de adapters inyectable

La ingesta del motor SHALL recibir las listas de adapters (`IngestAdapter` de archivos y `SyncAdapter` de sincronización) como parámetro del llamador. La semántica del pipeline con adapters inyectados SHALL preservar la actual: lectura incremental por offsets, dedup estable con insert-or-ignore, transacción por archivo, costeo materializado vía pricing y degradación sin abortar cuando un adapter de sincronización falla.

#### Scenario: Adapter custom de un proyecto externo

- **WHEN** un proyecto externo pasa su propio `IngestAdapter` que descubre un fixture JSONL y lo parsea al modelo normalizado
- **THEN** la ingesta registra sus eventos con costo, offsets y dedup exactamente como lo hace hoy con los adapters integrados

#### Scenario: Fallo de un adapter de sincronización inyectado

- **WHEN** un `SyncAdapter` inyectado lanza porque su fuente no existe
- **THEN** la ingesta continúa con los demás adapters y el fallo queda contado en el resumen

### Requirement: API pública de librería con raíz de datos inyectable

El motor SHALL exponer un barrel público único (tipos de adapters, ingesta, DB, pricing y update, quota framework, vistas y exportación) y SHALL permitir fijar su raíz de estado (`setDataDir`) de forma que DB, pricing local y reports vivan bajo esa raíz, independientemente del cwd del proceso consumidor.

#### Scenario: Consumo embebido en otro proyecto

- **WHEN** un proyecto externo hace `setDataDir(dir)` y ejecuta la ingesta y las vistas de resumen
- **THEN** todos los archivos de estado se crean bajo `dir` y el resultado no depende del cwd

### Requirement: Config store genérico

El motor SHALL ofrecer un helper de configuración genérico dirigido por schema: carga con defaults, validación con lista blanca de claves (rechazo de claves desconocidas), merge de updates parciales y guardado atómico. El helper SHALL ser agnóstico del schema concreto, que aporta el consumidor.

#### Scenario: Update parcial con clave desconocida

- **WHEN** se aplica un update parcial que incluye una clave fuera del schema
- **THEN** el update falla con error de validación y el archivo de configuración no cambia

#### Scenario: Guardado atómico

- **WHEN** se guarda la configuración y el proceso falla a mitad de escritura
- **THEN** el archivo previo queda intacto (escritura temporal + rename)
