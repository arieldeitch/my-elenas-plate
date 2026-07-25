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
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  BOOTSTRAP_PATH,
  BUILT_IN_FOODS,
  MIGRATION_PATH,
  buildBootstrapSql,
  buildSeedSql,
  spliceSeed,
} from "./catalog-seed-sql.ts";

/** Writes only when the content actually changes, so mtimes stay meaningful. */
function write(path: string, next: string): void {
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (current === next) {
    console.log(`up to date: ${path}`);
    return;
  }
  writeFileSync(path, next);
  console.log(`wrote: ${path}`);
}

write(MIGRATION_PATH, spliceSeed(readFileSync(MIGRATION_PATH, "utf8"), buildSeedSql()));
write(BOOTSTRAP_PATH, buildBootstrapSql());
console.log(`${BUILT_IN_FOODS.length} catalog items`);
