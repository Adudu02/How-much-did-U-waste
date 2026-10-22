/**
 * Facade: ingesta con la firma "raíces" histórica de how-much-did-u-waste-core.
 * Compone el registry del pack de adapters con el pipeline del motor genérico.
 */
import {
  ingestAll as engineIngestAll,
  type DB,
  type IngestSummary,
  type Pricing,
} from "agent-usage-engine";
import { getIngestAdapters, getSyncAdapters } from "agent-usage-adapters";

export interface IngestAllOpts {
  projectsRoot?: string;
  codexRoot?: string;
  qwenRoot?: string;
  zcodeRoot?: string;
  geminiRoot?: string;
  opencodeRoot?: string;
  grokRoot?: string;
  gooseRoot?: string;
  ampRoot?: string;
  crushRoot?: string;
  pricing?: Pricing;
  /** Legado: no usado por el motor (se conserva por compatibilidad de firma). */
  staleDays?: number;
  timeZone?: string;
  reparseSkills?: boolean;
}

export async function ingestAll(db: DB, opts: IngestAllOpts = {}): Promise<IngestSummary> {
  return engineIngestAll(db, {
    pricing: opts.pricing,
    staleDays: opts.staleDays,
    timeZone: opts.timeZone,
    reparseSkills: opts.reparseSkills,
    adapters: getIngestAdapters({
      claudeRoot: opts.projectsRoot,
      codexRoot: opts.codexRoot,
      qwenRoot: opts.qwenRoot,
      zcodeRoot: opts.zcodeRoot,
      geminiRoot: opts.geminiRoot,
    }),
    syncAdapters: getSyncAdapters({
      claudeRoot: opts.projectsRoot,
      opencodeRoot: opts.opencodeRoot,
      grokRoot: opts.grokRoot,
      gooseRoot: opts.gooseRoot,
      ampRoot: opts.ampRoot,
      crushRoot: opts.crushRoot,
    }),
  });
}
