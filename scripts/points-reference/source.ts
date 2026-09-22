/**
 * Points reference source access (pure; the writing entry point is `import.ts`).
 *
 * Reads `docs/data/nutrition-points-source.xlsx` (first sheet, first four
 * columns only), applies the documented cleaning rules
 * (`src/lib/points-reference/clean.ts`) and returns the versioned dataset +
 * import report. The file's sha-256 is recorded as provenance; a changed sheet
 * must get a new SOURCE_VERSION (new item ids), never a silent rewrite.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { cleanReferenceRows, type RawRow } from "../../src/lib/points-reference/clean.ts";
import type { ReferenceSource } from "../../src/lib/points-reference/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SOURCE_PATH = resolve(HERE, "../../docs/data/nutrition-points-source.xlsx");
export const DATASET_PATH = resolve(HERE, "../../src/data/points-reference/reference.v1.json");
export const REPORT_PATH = resolve(HERE, "../../src/data/points-reference/import-report.v1.json");
export const REPORT_MD_PATH = resolve(HERE, "../../docs/POINTS_REFERENCE_IMPORT_REPORT.md");
export const RUNTIME_PATH = resolve(
  HERE,
  "../../src/data/points-reference/reference.v1.runtime.json",
);

export const SOURCE_ID = "nikud-xlsx";
export const SOURCE_VERSION = "v1-2026-09-21";

export function readSourceRows(path = SOURCE_PATH): { rows: RawRow[]; source: ReferenceSource } {
  const bytes = readFileSync(path);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const wb = XLSX.read(bytes, { type: "buffer" });
  const sheet = wb.SheetNames[0];
  const ws = wb.Sheets[sheet];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
  const rows: RawRow[] = matrix.map((r, i) => ({
    row: i + 1,
    name: r[0] ?? null,
    quantity: r[1] ?? null,
    points: r[2] ?? null,
    category: r[3] ?? null,
  }));
  return {
    rows,
    source: {
      id: SOURCE_ID,
      version: SOURCE_VERSION,
      fileName: "docs/data/nutrition-points-source.xlsx",
      sha256,
      sheet,
    },
  };
}

export function buildDataset(path = SOURCE_PATH) {
  const { rows, source } = readSourceRows(path);
  return cleanReferenceRows(rows, source);
}
