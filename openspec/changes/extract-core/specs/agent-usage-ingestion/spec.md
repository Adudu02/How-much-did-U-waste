# agent-usage-ingestion — Delta Spec

## REMOVED Requirements

### Requirement: Cobertura de agentes en el registry

**Reason**: El registry con los adapters integrados y sus raíces por defecto se extrae del motor al paquete de adapters (`agent-adapters-pack`), de modo que el motor quede genérico e inyectable desde cualquier proyecto.
**Migration**: El requisito de cobertura (raíces por defecto, aislamiento de tests, `rootsFromConfig`) se re-declara en `agent-adapters-pack`; DFT lo consume a través del facade `how-much-did-u-waste-core`, que inyecta el registry del pack en la ingesta del motor.

### Requirement: Cobertura del registry de agentes

**Reason**: Ídem: la cobertura estática de los 10 agentes pasa a ser responsabilidad del pack de adapters, no del motor de ingesta.
**Migration**: Re-declarado en `agent-adapters-pack` como "Cobertura del registry de agentes"; el comportamiento observable de la ingesta de DFT no cambia.
