// @vitest-environment node
/**
 * DEC-035 acceptance item 15 — the importer is idempotent and the checked-in
 * dataset / report / seed SQL are exactly what the pipeline produces from the
 * committed source file. Re-running creates no duplicates and changes no id.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildDataset } from "../../../scripts/points-reference/source";
import {
  BEGIN_MARKER,
  buildReferenceSeedSql,
  END_MARKER,
  MIGRATION_PATH,
} from "../../../scripts/points-reference/seed-sql";
import { cleanReferenceRows, referenceItemId, type RawRow } from "./clean";
import dataset from "@/data/points-reference/reference.v1.json";
import report from "@/data/points-reference/import-report.v1.json";

const SOURCE = join(process.cwd(), "docs", "data", "nutrition-points-source.xlsx");

describe("15. importer re-runs without creating duplicates", () => {
  it("the committed dataset + report equal a fresh run over the committed xlsx (byte-identical)", () => {
    const fresh = buildDataset(SOURCE);
    expect(JSON.stringify(fresh.dataset)).toBe(JSON.stringify(dataset));
    expect(JSON.stringify(fresh.report)).toBe(JSON.stringify(report));
  });

  it("two runs over the same rows yield identical ids and counts; ids are deterministic per source row", () => {
    const a = buildDataset(SOURCE);
    const b = buildDataset(SOURCE);
    const source = a.dataset.source;
    expect(a.dataset.items.map((i) => i.id)).toEqual(b.dataset.items.map((i) => i.id));
    expect(new Set(a.dataset.items.map((i) => i.id)).size).toBe(a.dataset.items.length);
    expect(referenceItemId(source, 3)).toBe(a.dataset.items.find((i) => i.sourceRow === 3)!.id);
    // A different source version → different ids (never a silent rewrite).
    expect(referenceItemId({ ...source, version: "v2-later" }, 3)).not.toBe(
      referenceItemId(source, 3),
    );
  });

  it("the migration's generated seed block is up to date with the dataset", () => {
    const text = readFileSync(MIGRATION_PATH, "utf8");
    const current = text.slice(
      text.indexOf(BEGIN_MARKER) + BEGIN_MARKER.length,
      text.indexOf(END_MARKER),
    );
    expect(current.trim()).toBe(buildReferenceSeedSql().trim());
  });

  it("reports the counts the source was verified to contain", () => {
    expect(report.rowsInSheet).toBe(1401);
    expect(report.foodRows).toBe(1394);
    expect(report.uniqueSourceNames).toBe(1242);
    expect(report.uniqueNames).toBe(1240); // two spelling variants fold into one search key
    expect(report.headerRows).toBe(4);
    expect(report.exactDuplicatesDeprecated).toBe(2);
    expect(report.conflictGroups.map((c) => c.name)).toEqual([
      "יוגורט טבעי 2.9% שומן -200ג, 2",
      "משקה אורז 1% שומן",
      "רביולי פטריות",
    ]);
    expect(report.pointsPrecision.other).toBe(0);
    expect(report.cleaningRuleCounts["R07_category_truncation_fix_חלבון_מהח"]).toBe(1);
    expect(
      report.active + report.needsReview + report.conflicts + report.exactDuplicatesDeprecated,
    ).toBe(report.foodRows);
  });

  it("cleaning rules are explicit: a truncated name is review, not a guess; the side table is never read", () => {
    const source = { id: "t", version: "v", fileName: "f", sha256: "0", sheet: "s" };
    const rows: RawRow[] = [
      {
        row: 1,
        name: "מאכל או מנה",
        quantity: "כמות",
        points: "נקודות",
        category: "שייך לקבוצת מזון",
      },
      { row: 2, name: "אגס", quantity: "200 גרם", points: 2, category: "פירות" },
      {
        row: 3,
        name: "אגס (במסגרת 3 פירות טריים ב-",
        quantity: "200 גרם",
        points: 0,
        category: "פירות",
      },
      { row: 4, name: "דג טונה בעישון,", quantity: "100 גרם", points: 3, category: "חלבון מהחי" },
      { row: 5, name: null, quantity: null, points: null, category: null },
      { row: 6, name: "יוגורט", quantity: "200 ג", points: 4, category: "חלבון מהח" },
      { row: 7, name: "יוגורט", quantity: "200 ג", points: 5, category: "חלבון מהחי" },
      { row: 8, name: "מלפפון", quantity: ".", points: 0, category: "ירקות" },
      { row: 9, name: "מלפפון", quantity: ".", points: 0, category: "ירקות" },
      { row: 10, name: "A4", quantity: null, points: null, category: null },
    ];
    const { dataset: d, report: r } = cleanReferenceRows(rows, source);
    const by = (row: number) => d.items.find((i) => i.sourceRow === row)!;
    expect(r.headerRows).toBe(1);
    expect(r.blankRows).toBe(1);
    expect(r.nonFoodRows).toBe(1);
    expect(by(2).status).toBe("active");
    expect(by(3).rule).toBe("fruit_daily_allowance");
    expect(by(3).benefitOf).toBe(by(2).id);
    expect(by(3).displayName).toBe("אגס (במסגרת 3 פירות טריים ב-"); // never "fixed"
    expect(by(4).status).toBe("needs_review");
    expect(by(4).reviewReasons).toContain("name_truncated");
    expect(by(6).category).toBe("חלבון מהחי");
    expect(by(6).sourceCategory).toBe("חלבון מהח");
    expect([by(6).status, by(7).status]).toEqual(["conflict", "conflict"]);
    expect(by(8).status).toBe("active");
    expect(by(8).portion?.family).toBe("any");
    expect(by(9).status).toBe("deprecated");
    expect(by(9).duplicateOf).toBe(by(8).id);
  });
});
