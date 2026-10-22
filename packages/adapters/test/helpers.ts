/**
 * Helper de tests: replica la firma "raíces" de ingestAll (la que expone el
 * facade how-much-did-u-waste-core) componiendo el registry del pack con el
 * pipeline del motor. Los tests movidos desde packages/core la usan tal cual.
 */
import {
  ingestAll as engineIngestAll,
  type DB,
  type Pricing,
  type IngestSummary,
} from "agent-usage-engine";
import { getIngestAdapters, getSyncAdapters } from "../src/adapters/registry.js";

export interface IngestRootsOpts {
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
  staleDays?: number;
  timeZone?: string;
  reparseSkills?: boolean;
}

export function ingestAll(db: DB, opts: IngestRootsOpts = {}): Promise<IngestSummary> {
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
