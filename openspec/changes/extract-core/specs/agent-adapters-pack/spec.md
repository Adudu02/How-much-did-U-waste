## Purpose

Define el paquete de adapters de agentes de código como módulo separado del motor: los 10 adapters de ingesta/sincronización con sus raíces por defecto, los probers de quota integrados y la traducción de `config.agentPaths`, de modo que DFT (u otro proyecto) los consuma como un pack opcional sobre el motor genérico.

## ADDED Requirements

### Requirement: Cobertura del registry de agentes

El pack SHALL incluir los adapters de archivo (Claude Code, Codex, Qwen, ZCode, Gemini CLI) y los adapters de sincronización (OpenCode, grok-cli, Goose, Amp, Crush) con sus raíces por defecto, con la regla de aislamiento de tests: si el llamador sobreescribe la raíz de Claude, las raíces por defecto de los demás agentes NO se agregan salvo que se pasen explícitamente; en producción (sin overrides) todos usan su raíz real.

#### Scenario: Ingesta cubre todos los agentes soportados

- **WHEN** la ingesta corre sin overrides de raíces usando el registry del pack
- **THEN** descubre y procesa fuentes de Claude Code, Codex, Qwen, ZCode, Gemini CLI, OpenCode, grok-cli, Goose, Amp y Crush

#### Scenario: Aislamiento de tests preservado

- **WHEN** un test sobreescribe `projectsRoot` sin pasar las raíces de los demás adapters
- **THEN** esos adapters no se incluyen (sin lecturas fuera del fixture)

### Requirement: Traducción de agentPaths

`rootsFromConfig` SHALL exponer las claves de todos los agentes soportados para que personalizar la ruta de uno nunca excluya a los demás en producción: la clave no configurada se resuelve a la raíz por defecto del agente y los valores con `~/` se expanden a la home.

#### Scenario: Ruta de Claude personalizada no excluye a los demás

- **WHEN** `rootsFromConfig` recibe un `agentPaths` con solo la ruta de Claude personalizada
- **THEN** las raíces de los demás agentes se resuelven a sus defaults y siguen incluidas en la ingesta

### Requirement: Probers de quota integrados

El pack SHALL incluir los probers de quota (Claude, Codex, Z.ai GLM, Gemini, Copilot, OpenRouter) como registro pasable al framework de quota del motor, preservando el aislamiento por fallo, las credenciales solo en memoria y la precedencia live > offline-stale de Codex.

#### Scenario: Registro de probers inyectado en el framework

- **WHEN** el refresh de quota corre con el registro del pack y un prober falla
- **THEN** los demás probers producen sus snapshots y el fallo queda reportado con su causa
