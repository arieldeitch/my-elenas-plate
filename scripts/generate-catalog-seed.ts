/**
 * Regenerates the catalog seed inside the cleanup/seed migration from the
 * TypeScript catalog modules, so the app and the database can never drift.
 *
 *   npm run catalog:seed
 *
 * Only the text between the BEGIN/END GENERATED CATALOG SEED markers is
 * replaced; the hand-authored cleanup sections are left untouched.
 * `src/lib/catalog-seed.test.ts` fails if the checked-in file is out of date.
 *
 * This module writes on import — that is its whole job. The reusable logic lives
 * in `./catalog-seed-sql.ts`, which has no side effects.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { BUILT_IN_FOODS, MIGRATION_PATH, buildSeedSql, spliceSeed } from "./catalog-seed-sql.ts";

const current = readFileSync(MIGRATION_PATH, "utf8");
const next = spliceSeed(current, buildSeedSql());

if (next === current) {
  console.log(`Already up to date: ${BUILT_IN_FOODS.length} catalog rows in ${MIGRATION_PATH}`);
} else {
  writeFileSync(MIGRATION_PATH, next);
  console.log(`Wrote ${BUILT_IN_FOODS.length} catalog rows into ${MIGRATION_PATH}`);
}
