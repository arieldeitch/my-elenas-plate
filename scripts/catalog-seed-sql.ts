/**
 * Pure helpers that turn the TypeScript catalog into the seed SQL block.
 *
 * Side-effect free on purpose: `src/lib/catalog-seed.test.ts` imports this to
 * assert the checked-in migration is the current generated form, while
 * `generate-catalog-seed.ts` is the entry point that actually writes the file.
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { BUILT_IN_FOODS } from "../src/lib/food-catalog.ts";
import { normalizeFoodName } from "../src/lib/food-normalize.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

export const MIGRATION_PATH = resolve(
  HERE,
  "../supabase/migrations/20260725190000_cleanup_mock_data_and_seed_food_catalog.sql",
);
export const BEGIN_MARKER = "-- >>> BEGIN GENERATED CATALOG SEED";
export const END_MARKER = "-- <<< END GENERATED CATALOG SEED";

const q = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** Builds the SQL block that seeds every household with the catalog. */
export function buildSeedSql(): string {
  const rows = BUILT_IN_FOODS.map((food) => {
    const cells = [
      q(food.name),
      q(normalizeFoodName(food.name)),
      q(food.category ?? ""),
      q(food.defaultUnit ?? ""),
      q(food.kind ?? "generic"),
    ];
    return `  (${cells.join(", ")})`;
  });

  return [
    "with catalog (name, normalized_name, category, default_unit, kind) as (values",
    rows.join(",\n"),
    "),",
    "upserted as (",
    "  insert into public.foods (household_id, name, normalized_name, category, default_unit, kind, is_active)",
    "  select h.id, c.name, c.normalized_name, c.category, c.default_unit, c.kind, true",
    "  from public.households h",
    "  cross join catalog c",
    "  on conflict (household_id, normalized_name) do update",
    "    set name = excluded.name,",
    "        category = excluded.category,",
    "        default_unit = excluded.default_unit,",
    "        kind = excluded.kind",
    "  -- is_active is deliberately NOT reset: if a household archived a food,",
    "  -- re-running the seed must not resurrect it.",
    "  returning (xmax::text::bigint = 0) as inserted",
    ")",
    "insert into catalog_migration_report (step, detail, count)",
    "select '7_seed', case when inserted then 'foods_inserted' else 'foods_updated' end, count(*)",
    "from upserted",
    "group by inserted;",
    "",
    "insert into catalog_migration_report (step, detail, count)",
    "values",
    `  ('7_seed', 'catalog_items_defined', ${BUILT_IN_FOODS.length}),`,
    "  ('7_seed', 'households_seeded', (select count(*) from public.households));",
  ].join("\n");
}

/** Splices a freshly built seed block into the migration file's markers. */
export function spliceSeed(sql: string, seed: string): string {
  const begin = sql.indexOf(BEGIN_MARKER);
  const end = sql.indexOf(END_MARKER);
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(`generated-seed markers missing or out of order in ${MIGRATION_PATH}`);
  }
  return `${sql.slice(0, begin + BEGIN_MARKER.length)}\n${seed}\n${sql.slice(end)}`;
}

/** Extracts the generated block from a migration file (used by the parity test). */
export function extractSeed(sql: string): string {
  const begin = sql.indexOf(BEGIN_MARKER);
  const end = sql.indexOf(END_MARKER);
  if (begin === -1 || end === -1 || end < begin) throw new Error("generated-seed markers missing");
  return sql.slice(begin + BEGIN_MARKER.length, end).trim();
}

export { BUILT_IN_FOODS };
