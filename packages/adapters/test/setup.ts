/**
 * Setup global de los tests del pack: siembra un data dir temporal con el
 * pricing.json de fábrica del motor (mismo flujo que ensureUserData en
 * producción) para que los `loadPricing()` sin path explícito funcionen sin
 * tocar el estado real del repo.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setDataDir, packagedPricingPath } from "agent-usage-engine";

const tmp = join(tmpdir(), `adapters-test-data-${process.pid}`);
mkdirSync(tmp, { recursive: true });
copyFileSync(packagedPricingPath(), join(tmp, "pricing.json"));
setDataDir(tmp);
