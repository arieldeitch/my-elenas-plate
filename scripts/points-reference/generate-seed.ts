/**
 * Regenerates the seed block of the points-reference migration from the
 * checked-in dataset — `npm run points:seed`. Writes on import; the reusable
 * logic lives in `./seed-sql.ts`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  buildProductionWrapper,
  buildReferenceSeedSql,
  MIGRATION_PATH,
  spliceReferenceSeed,
  WRAPPER_PATH,
} from "./seed-sql.ts";

function write(path: string, next: string): void {
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (current === next) {
    console.log(`up to date: ${path}`);
    return;
  }
  writeFileSync(path, next);
  console.log(`wrote: ${path}`);
}

const migration = spliceReferenceSeed(
  readFileSync(MIGRATION_PATH, "utf8"),
  buildReferenceSeedSql(),
);
write(MIGRATION_PATH, migration);
// The owner-run production wrapper is the migration + the CLI ledger row.
write(WRAPPER_PATH, buildProductionWrapper(migration));
