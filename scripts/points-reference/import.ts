/**
 * Points reference importer — `npm run points:import`.
 *
 * Writes on import (that is its whole job); the reusable logic lives in
 * `./source.ts`. Deterministic: re-running on the same file rewrites
 * byte-identical JSON. `src/lib/points-reference/pipeline.test.ts` fails if
 * the checked-in dataset is out of date.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { toRuntimeItem } from "../../src/lib/points-reference/types.ts";
import { buildDataset, DATASET_PATH, REPORT_MD_PATH, REPORT_PATH, RUNTIME_PATH } from "./source.ts";
import { buildImportReportMd } from "./report-md.ts";

function write(path: string, next: string): void {
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (current === next) {
    console.log(`up to date: ${path}`);
    return;
  }
  writeFileSync(path, next);
  console.log(`wrote: ${path}`);
}

const { dataset, report } = buildDataset();
write(DATASET_PATH, JSON.stringify(dataset, null, 1) + "\n");
write(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
write(REPORT_MD_PATH, buildImportReportMd(report, dataset));
// The bundled runtime projection: no source / audit columns (bundle size).
write(
  RUNTIME_PATH,
  JSON.stringify({ source: dataset.source, items: dataset.items.map(toRuntimeItem) }) + "\n",
);
console.log(
  `${report.foodRows} food rows → active ${report.active} · needs_review ${report.needsReview} · conflict ${report.conflicts} · deprecated ${report.exactDuplicatesDeprecated}`,
);
