/**
 * DEC-038 — the migration SQL and the generated Supabase types describe the
 * same surface. Same idea as the DEC-037 parity test, extended to the two
 * things DEC-038 adds: a household table the client reads directly, and a set
 * of RPCs that are the ONLY way to the private body data.
 *
 * Both files are read as text — no database, no Docker.
 *
 * The RPC half matters more than usual here. `weigh_ins` is unreachable from
 * the browser after this migration, so a body_* function missing from the
 * generated types is not a typing inconvenience: it is a call the client
 * cannot make and a screen that cannot load.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..", "..");
const SQL = readFileSync(
  join(ROOT, "supabase/migrations/20260924090000_calculated_products_private_body.sql"),
  "utf8",
);
const TYPES = readFileSync(join(ROOT, "src/lib/supabase/database.generated.ts"), "utf8");

/** Top-level column names of a `create table` block. */
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
  return columns.sort();
}

/** Row column names the generated types declare for a table. */
function typeColumns(table: string): string[] {
  const start = TYPES.indexOf(`      ${table}: {`);
  expect(start, `no generated type for ${table}`).toBeGreaterThanOrEqual(0);
  const rowStart = TYPES.indexOf("Row: {", start);
  const body = TYPES.slice(rowStart, TYPES.indexOf("}", rowStart));
  return [...body.matchAll(/^\s{10}([a-z_][a-z0-9_]*)\??:/gm)].map((m) => m[1]).sort();
}

describe("DEC-038 schema parity", () => {
  it("calculated_products: the migration and the generated types agree", () => {
    expect(typeColumns("calculated_products")).toEqual(sqlColumns("calculated_products"));
  });

  it("food_entries gains the three provenance columns in both places", () => {
    for (const column of ["calculated_product_id", "calculated_revision", "basis_snapshot"]) {
      expect(SQL, `migration adds ${column}`).toContain(`add column if not exists ${column}`);
      expect(TYPES, `generated types know ${column}`).toContain(`${column}:`);
    }
  });

  it("every callable body_* RPC is in the generated types", () => {
    // The functions the migration explicitly grants to `authenticated` are the
    // client's entire vocabulary for private body data.
    const granted = [...SQL.matchAll(/grant execute on function public\.(body_[a-z_]+)\s*\(/g)].map(
      (m) => m[1],
    );
    expect(granted.length, "no granted body_* functions found").toBeGreaterThan(0);
    for (const fn of new Set(granted)) {
      expect(
        TYPES,
        `${fn} is granted to authenticated but missing from the generated types`,
      ).toContain(`${fn}: {`);
    }
  });

  it("body_privacy stays out of the generated types, because the client cannot touch it", () => {
    // RLS on with no policies AND no grant to anon/authenticated — so the PIN
    // table must not appear in the client's schema at all.
    expect(SQL).toMatch(/revoke all on table public\.body_privacy from anon, authenticated/);
    expect(TYPES).not.toContain("body_privacy");
  });

  it("weigh_ins is unreachable from the browser after this migration", () => {
    expect(SQL).toMatch(/revoke all on table public\.weigh_ins from anon, authenticated/);
    expect(SQL).toMatch(/alter publication supabase_realtime drop table public\.weigh_ins/);
  });
});
