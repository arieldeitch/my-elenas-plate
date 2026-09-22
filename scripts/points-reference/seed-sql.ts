/**
 * Pure helpers that turn the checked-in reference dataset into the seed SQL
 * block of `supabase/migrations/20260921120000_points_reference.sql`.
 *
 * Side-effect free: `src/lib/points-reference/pipeline.test.ts` imports this to
 * assert the checked-in migration is the current generated form, while
 * `generate-seed.ts` is the entry point that writes the file.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dataset from "../../src/data/points-reference/reference.v1.json";
import type { ReferenceDataset, ReferenceItem } from "../../src/lib/points-reference/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
export const MIGRATION_PATH = resolve(
  HERE,
  "../../supabase/migrations/20260921120000_points_reference.sql",
);
export const WRAPPER_PATH = resolve(HERE, "../../supabase/apply_points_reference_production.sql");
export const BEGIN_MARKER = "-- >>> BEGIN GENERATED POINTS REFERENCE SEED";
export const END_MARKER = "-- <<< END GENERATED POINTS REFERENCE SEED";

const q = (value: string | null | undefined) =>
  value == null ? "null" : `'${value.replace(/'/g, "''")}'`;
const arr = (values: string[] | undefined) =>
  `array[${(values ?? []).map((v) => q(v)).join(", ")}]::text[]`;
const num = (v: number) => (Number.isFinite(v) ? String(v) : "null");
const jsonb = (v: unknown) => (v == null ? "null" : `${q(JSON.stringify(v))}::jsonb`);
const uuid = (v: string | undefined) => (v ? `${q(v)}::uuid` : "null");

function itemValues(items: ReferenceItem[], sourceId: string, version: string): string {
  return items
    .map((it) => {
      const cells = [
        `${q(it.id)}::uuid`,
        q(sourceId),
        q(version),
        String(it.sourceRow),
        q(it.sourceName),
        q(it.sourceQuantityText),
        num(it.sourcePoints),
        q(it.sourceCategory),
        q(it.displayName),
        q(it.normalizedName),
        q(it.baseName),
        q(it.category),
        jsonb(it.portion),
        num(it.points),
        q(it.status),
        q(it.rule),
        uuid(it.benefitOf),
        arr(it.reviewReasons),
        arr(it.cleaningRules),
        q(it.conflictGroup),
        uuid(it.duplicateOf),
        arr(it.notes),
      ];
      return `  (${cells.join(", ")})`;
    })
    .join(",\n");
}

/** The generated block (markers excluded). */
export function buildReferenceSeedSql(
  data: ReferenceDataset = dataset as ReferenceDataset,
): string {
  const { source, items } = data;
  return [
    `-- ${items.length} reference rows from ${source.fileName} (sha256 ${source.sha256}), version ${source.version}.`,
    "insert into public.food_reference_sources (id, version, file_name, sha256, sheet)",
    `values (${q(source.id)}, ${q(source.version)}, ${q(source.fileName)}, ${q(source.sha256)}, ${q(source.sheet)})`,
    "on conflict (id) do update",
    "  set version = excluded.version, file_name = excluded.file_name, sha256 = excluded.sha256, sheet = excluded.sheet;",
    "",
    "-- Self-references (benefit_of / duplicate_of) point at rows of the same batch, so",
    "-- the batch is inserted in two passes: rows first, links second.",
    "with rows (id, source_id, source_version, source_row, source_name, source_quantity_text, source_points,",
    "           source_category, display_name, normalized_name, base_name, category, portion, points, status,",
    "           rule, benefit_of, review_reasons, cleaning_rules, conflict_group, duplicate_of, notes) as (values",
    itemValues(items, source.id, source.version),
    ")",
    "insert into public.food_reference_items (id, source_id, source_version, source_row, source_name,",
    "  source_quantity_text, source_points, source_category, display_name, normalized_name, base_name,",
    "  category, portion, points, status, rule, review_reasons, cleaning_rules, conflict_group, notes)",
    "select id, source_id, source_version, source_row, source_name, source_quantity_text, source_points,",
    "  source_category, display_name, normalized_name, base_name, category, portion, points, status, rule,",
    "  review_reasons, cleaning_rules, conflict_group, notes",
    "from rows",
    "on conflict (source_id, source_version, source_row) do update",
    "  set source_name = excluded.source_name,",
    "      source_quantity_text = excluded.source_quantity_text,",
    "      source_points = excluded.source_points,",
    "      source_category = excluded.source_category,",
    "      display_name = excluded.display_name,",
    "      normalized_name = excluded.normalized_name,",
    "      base_name = excluded.base_name,",
    "      category = excluded.category,",
    "      portion = excluded.portion,",
    "      points = excluded.points,",
    "      status = excluded.status,",
    "      rule = excluded.rule,",
    "      review_reasons = excluded.review_reasons,",
    "      cleaning_rules = excluded.cleaning_rules,",
    "      conflict_group = excluded.conflict_group,",
    "      notes = excluded.notes;",
    "",
    "update public.food_reference_items i",
    "set benefit_of = l.benefit_of, duplicate_of = l.duplicate_of",
    "from (values",
    items
      .filter((it) => it.benefitOf || it.duplicateOf)
      .map((it) => `  (${q(it.id)}::uuid, ${uuid(it.benefitOf)}, ${uuid(it.duplicateOf)})`)
      .join(",\n"),
    ") as l (id, benefit_of, duplicate_of)",
    "where i.id = l.id",
    "  and (i.benefit_of is distinct from l.benefit_of or i.duplicate_of is distinct from l.duplicate_of);",
  ].join("\n");
}

/** Replaces the generated block inside the migration text. */
export function spliceReferenceSeed(migration: string, seed: string): string {
  const begin = migration.indexOf(BEGIN_MARKER);
  const end = migration.indexOf(END_MARKER);
  if (begin < 0 || end < 0 || end < begin) throw new Error("seed markers not found in migration");
  return `${migration.slice(0, begin + BEGIN_MARKER.length)}\n${seed}\n${migration.slice(end)}`;
}

/**
 * The production apply wrapper (Dashboard SQL Editor, owner account): the whole
 * migration inside one transaction, then the CLI ledger row so a future
 * `supabase db push` never re-runs it. Idempotent end to end.
 */
export function buildProductionWrapper(migration: string): string {
  return [
    "-- ============================================================================",
    "-- Points reference (DEC-035) — apply migration 20260921120000 to PRODUCTION",
    "-- (project rqgoiuztphkcvbwtbxbj) from the Dashboard SQL Editor / Management API,",
    "-- and record it in the CLI migration ledger. GENERATED by `npm run points:seed`",
    "-- from supabase/migrations/20260921120000_points_reference.sql — do not edit.",
    "-- Reviewed 2026-09-21 (docs/claude-tasks/RUN_2026-09-21_POINTS_REFERENCE.md).",
    "--   * creates food_reference_sources / _items / _aliases (shared, read-only for",
    "--     authenticated, nothing for anon, RLS on) and seeds the reference rows",
    "--     (upsert on source id + version + row: re-running never duplicates);",
    "--   * ADD COLUMN IF NOT EXISTS only on foods and food_entries (all nullable or",
    "--     defaulted); no existing row, policy or snapshot is changed.",
    "-- HOW TO USE: run supabase/verify_points_reference.sql (read-only) before and after.",
    "-- ============================================================================",
    "",
    "begin;",
    "",
    migration.trimEnd(),
    "",
    "do $$",
    "begin",
    "  if to_regclass('supabase_migrations.schema_migrations') is null then",
    "    raise notice 'supabase_migrations.schema_migrations not found — ledger not updated';",
    "    return;",
    "  end if;",
    "  insert into supabase_migrations.schema_migrations (version, name, statements)",
    "  values ('20260921120000', 'points_reference',",
    "          array['create table if not exists public.food_reference_sources / food_reference_items / food_reference_aliases + RLS select for authenticated',",
    "                'alter table public.foods add column if not exists portion_amount / portion_unit / points_per_portion / points_status / created_by_profile_id / points_confirmed_at',",
    "                'alter table public.food_entries add column if not exists points_basis / reference_item_id / base_points / benefit_rule',",
    "                'seed food_reference_items from docs/data/nutrition-points-source.xlsx (upsert, idempotent)'])",
    "  on conflict (version) do nothing;",
    "end;",
    "$$;",
    "",
    "commit;",
    "",
    "-- Post-check (expected: 1394 rows; active 1308 / needs_review 78 / conflict 6 / deprecated 2)",
    "select status, count(*) from public.food_reference_items group by status order by status;",
    "",
  ].join("\n");
}
