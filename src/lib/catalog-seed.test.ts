/**
 * Guards the contract between the TypeScript catalog and the seed SQL:
 * the migration must always be the generated form of the current catalog, and
 * it must never write anything but `foods` rows.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  BEGIN_MARKER,
  END_MARKER,
  MIGRATION_PATH,
  buildSeedSql,
  extractSeed,
} from "../../scripts/catalog-seed-sql.ts";
import { BUILT_IN_FOODS } from "./food-catalog";
import { normalizeFoodName } from "./food-normalize";

const migration = readFileSync(MIGRATION_PATH, "utf8");
const seed = extractSeed(migration);

/**
 * Executable SQL only. The safety scans below must not trip over the file's own
 * documentation (which names the things it promises not to do) — nor over food
 * names, which legitimately contain words like "דל שומן".
 */
const statements = migration
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

describe("catalog seed SQL", () => {
  it("is up to date with the catalog modules (run `npm run catalog:seed`)", () => {
    expect(seed).toBe(buildSeedSql());
  });

  it("keeps the generated block delimited so cleanup SQL is never overwritten", () => {
    expect(migration.indexOf(BEGIN_MARKER)).toBeGreaterThan(-1);
    expect(migration.indexOf(END_MARKER)).toBeGreaterThan(migration.indexOf(BEGIN_MARKER));
  });

  it("declares one row per catalog item", () => {
    // The catalog CTE's VALUES rows: the report rows that follow are excluded by
    // their step label.
    const rows = seed
      .split("\n")
      .filter((line) => /^ {2}\('/.test(line) && !line.includes("'7_seed'"));
    expect(rows).toHaveLength(BUILT_IN_FOODS.length);
    expect(seed).toContain(`'catalog_items_defined', ${BUILT_IN_FOODS.length}`);
  });

  it("contains every food with its normalized name and default unit", () => {
    for (const food of BUILT_IN_FOODS) {
      const row = `('${food.name}', '${normalizeFoodName(food.name)}', '${food.category}', '${food.defaultUnit}', '${food.kind ?? "generic"}')`;
      expect(seed, food.name).toContain(row);
    }
  });

  it("is idempotent: upsert on the existing unique constraint", () => {
    expect(seed).toContain("on conflict (household_id, normalized_name) do update");
    // Exactly one write to `foods`, and it is the conflict-handling one.
    expect(seed.match(/insert into public\.foods/g)).toHaveLength(1);
    // Re-running must not resurrect a food the household archived.
    expect(seed).not.toMatch(/set[\s\S]*?is_active\s*=/i);
  });

  it("seeds every household, so both profiles share one catalog", () => {
    expect(seed).toContain("from public.households h");
    expect(seed).toContain("cross join catalog c");
  });

  it("writes no favorites, recents, entries or statuses", () => {
    for (const table of [
      "food_preferences",
      "food_entries",
      "meal_statuses",
      "fasting_logs",
      "workout_logs",
      "weigh_ins",
      "profiles",
      "households (",
      "auth.",
    ]) {
      expect(seed.includes(`insert into public.${table}`), table).toBe(false);
    }
    expect(seed).not.toMatch(/is_favorite|last_used_at|use_count/);
  });

  it("writes only the columns that exist in the foods schema", () => {
    const columns = seed.match(/insert into public\.foods \(([^)]*)\)/)![1];
    expect(columns.split(",").map((c) => c.trim())).toEqual([
      "household_id",
      "name",
      "normalized_name",
      "category",
      "default_unit",
      "kind",
      "is_active",
    ]);
    // No nutrition/scoring identifier anywhere in the executable seed.
    expect(columns.toLowerCase()).not.toMatch(/calor|kcal|protein|carb|fat|macro|score|health/);
  });
});

describe("cleanup SQL safety", () => {
  const cleanup = statements.slice(0, statements.indexOf("BEGIN GENERATED CATALOG SEED"));

  it("never disables row level security or touches a policy", () => {
    expect(statements.toLowerCase()).not.toMatch(/disable\s+row\s+level\s+security/);
    expect(statements.toLowerCase()).not.toMatch(/(drop|create|alter)\s+policy/);
  });

  it("never truncates and never modifies auth.users", () => {
    expect(statements.toLowerCase()).not.toMatch(/truncate/);
    expect(statements.toLowerCase()).not.toMatch(/(delete\s+from|update|insert\s+into)\s+auth\./);
  });

  it("has no unconditional delete against a data table", () => {
    // Every DELETE must be qualified; the only unqualified ones are the two
    // temporary bookkeeping tables this script creates itself.
    const deletes = [...statements.matchAll(/delete\s+from\s+([a-z_.]+)([^;]*);/gi)];
    expect(deletes.length).toBeGreaterThan(0);
    for (const [, table, rest] of deletes) {
      const qualified = /\bwhere\b|\busing\b/i.test(rest);
      const isTempBookkeeping =
        table === "catalog_migration_report" || table === "demo_day_matches";
      expect(qualified || isTempBookkeeping, `unqualified delete from ${table}`).toBe(true);
    }
  });

  it("only ever deletes from the expected tables", () => {
    const tables = new Set(
      [...statements.matchAll(/delete\s+from\s+(?:public\.)?([a-z_]+)/gi)].map((m) =>
        m[1].toLowerCase(),
      ),
    );
    expect([...tables].sort()).toEqual([
      "catalog_migration_report",
      "demo_day_matches",
      "fasting_logs",
      "food_entries",
      "food_preferences",
      "foods",
      "households",
      "meal_statuses",
      "weigh_ins",
      "workout_logs",
    ]);
    // Profiles, memberships and auth are never a delete target.
    expect(tables.has("profiles")).toBe(false);
    expect(tables.has("household_users")).toBe(false);
  });

  it("identifies test accounts by the generated email shape, not by date", () => {
    expect(cleanup).toContain("^(e2e|t|live)_[0-9]{13}_[0-9]+@");
    expect(cleanup).not.toMatch(/created_at\s*[<>]/);
  });

  it("keys demo days on the full entry signature from demo-data.ts", () => {
    for (const signature of [
      "opening_window|חביתה|measured|2|יחידה|",
      "main_meal|חזה עוף|measured|180|גרם|",
      "afternoon_snack|שקדים|subjective|||little",
      "main_meal|סלט ירקות|subjective|||moderate",
    ]) {
      expect(cleanup, signature).toContain(signature);
    }
    expect(cleanup).toContain("having bool_and(is_demo)");
  });

  it("uses the deterministic recency epoch for demo preferences", () => {
    expect(cleanup).toContain("to_timestamp(1784000000 - g * 60)");
  });

  it("reports before and after counts for every tracked table", () => {
    for (const table of [
      "households",
      "profiles",
      "foods",
      "food_entries",
      "meal_statuses",
      "fasting_logs",
      "workout_logs",
      "weigh_ins",
      "food_preferences",
    ]) {
      expect(migration, table).toContain(`('0_before', '${table}'`);
      expect(migration, table).toContain(`('8_after', '${table}'`);
    }
  });
});
