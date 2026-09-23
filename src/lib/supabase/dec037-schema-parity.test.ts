/**
 * DEC-037 acceptance 24 — the migration SQL and the generated Supabase types
 * describe the SAME columns.
 *
 * The types file is generated against a database, the migration is what will
 * create those tables in production; if they drift, the client compiles
 * happily and then writes a column the server does not have. This test reads
 * both files as text (no database, no Docker) and compares the column names.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..", "..");
const SQL = readFileSync(
  join(ROOT, "supabase/migrations/20260923090000_dishes_bridges_estimated.sql"),
  "utf8",
);
const TYPES = readFileSync(join(ROOT, "src/lib/supabase/database.generated.ts"), "utf8");

const TABLES = ["estimated_products", "weight_bridges", "dishes", "dish_versions"] as const;

/**
 * Column names of a `create table` block: the lines that START a definition at
 * the top level of the parentheses. Tracking the nesting depth is what keeps a
 * multi-line `constraint … check (…)` from contributing its own body as if it
 * were a column.
 */
function sqlColumns(table: string): string[] {
  const start = SQL.indexOf(`create table if not exists public.${table} (`);
  expect(start, `no create table block for ${table}`).toBeGreaterThanOrEqual(0);
  const body = SQL.slice(SQL.indexOf("(", start) + 1, SQL.indexOf("\n);", start));
  const columns: string[] = [];
  let depth = 0;
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    const topLevel = depth === 0;
    for (const ch of line) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
    }
    if (!topLevel || !line || line.startsWith("--")) continue;
    if (/^(unique|constraint|primary key|check|foreign key)\b/i.test(line)) continue;
    const name = line.split(/\s+/)[0];
    if (/^[a-z_][a-z0-9_]*$/.test(name)) columns.push(name);
  }
  return columns;
}

/** Column names of the `Row:` shape of a generated table type. */
function typeColumns(table: string): string[] {
  const at = TYPES.indexOf(`      ${table}: {`);
  expect(at, `no generated type for ${table}`).toBeGreaterThanOrEqual(0);
  const rowStart = TYPES.indexOf("Row: {", at);
  const rowEnd = TYPES.indexOf("\n        }", rowStart);
  return TYPES.slice(rowStart + "Row: {".length, rowEnd)
    .split("\n")
    .map((line) => line.trim().split(":")[0])
    .filter(Boolean);
}

describe("24. the DEC-037 migration and the generated types agree", () => {
  it.each(TABLES)("%s has the same columns in SQL and in the types", (table) => {
    const sql = sqlColumns(table);
    // no column is listed twice — a parse that swallowed a constraint body
    expect(new Set(sql).size).toBe(sql.length);
    expect([...typeColumns(table)].sort()).toEqual([...sql].sort());
  });

  it("every column added to food_entries exists in its generated type", () => {
    const added = [
      ...SQL.matchAll(/alter table public\.food_entries add column if not exists (\w+)/g),
    ].map((m) => m[1]);
    expect(added).toEqual([
      "dish_id",
      "dish_revision",
      "estimated_product_id",
      "consumed_weight_g",
      "weight_source",
    ]);
    const entries = TYPES.slice(
      TYPES.indexOf("      food_entries: {"),
      TYPES.indexOf("      food_preferences: {"),
    );
    for (const column of added) expect(entries).toContain(`          ${column}: `);
  });
});
