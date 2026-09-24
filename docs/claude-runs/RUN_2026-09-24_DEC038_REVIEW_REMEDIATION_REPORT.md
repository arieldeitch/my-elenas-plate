# RUN 2026-09-24 — DEC-038 review and remediation

**Branch:** `claude/dec038-review-remediation` from `origin/main` `42fabb4733dbc2c7a371e62a8d0905fd77a376da`
**Nature:** current-main recovery + code review + remediation. Not a DEC-037 deployment run.
**Production:** untouched. Migration `20260924090000` **not applied**. Nothing published.

## Repository recovery

The previous run worked from `910ff05`, which was stale: the DEC-038 implementation had landed on
`main` through Lovable afterwards. The local clone was at exactly `910ff05` with a clean tree, so
nothing needed preserving. After `git fetch`, `origin/main` was `42fabb47…`, exactly the commit the
task named, and `910ff05` is its ancestor. Local `main` fast-forwarded; both required files were
present (`docs/claude-tasks/RUN_2026-09-24_…md`, `supabase/migrations/20260924090000_…sql`).

Between the two commits: 20 commits, 18 files, +1830/−40. **No `.tsx` file changed** — the entire
delta is `src/lib`, the migration and tests.

## What Lovable had already implemented

| Area | State as found |
| --- | --- |
| Calculated products | Domain layer complete and correct (`calculated-products.ts`), wired into `points.ts` and `dishes.ts`. No UI, no repository, no sync. |
| Private body | Migration complete: grants removed, realtime dropped, bcrypt PIN, SECURITY DEFINER RPCs, cross-profile denial. No UI, no client data path, no RPC caller outside a test. |
| Unit conversions | `unit-conversion.ts` with precedence, group scoping, tolerance and review-row exclusion; wired into scoring. `convertibleUnits` written but imported only by a test, so the UI never offered the new units. |
| Tests | A PGlite migration suite and a domain suite, both substantial. |

## Issues found

| # | Severity | Issue |
| --- | --- | --- |
| 1 | P0 | **`main` did not compile.** The old weight-bridge block stayed in `resolveIngredient` after the new `convertQuantity` path replaced it: a stray brace closed the function early, ~20 lines referenced `bridge`/`portionUnit` out of scope, and a duplicate return followed. `tsc` reported TS1128 twice. |
| 2 | P0 | **The PIN throttle could be bypassed entirely.** `body_require_pin` raised on a wrong PIN; the raise rolled back the failed-attempt counter `body_check_pin` had just written. Ten wrong PINs through `body_list_weigh_ins` left `failed_attempts = 0` and never locked — a 6-digit PIN was brute-forceable without limit. Only `body_unlock`, which returns instead of raising, actually counted. |
| 3 | P0 (deploy) | **The migration and the client are a matched pair and only one half exists.** The migration revokes all `authenticated` access to `weigh_ins` and drops it from realtime; `repositories.ts` still calls `.from("weigh_ins")` and `supabase-sync.ts` still syncs it. Applying it now returns `permission denied` for every existing weigh-in, with no screen able to read them back. |
| 4 | P1 | **The inference invented precision.** It divides one half-point-rounded points value by another. One count row against one weight row yields exactly one estimate, so the spread check compares it with itself and always passes. Real data: דבש 1 כפית → 11.1 g against a true ≈ 7 g (59% out), presented identically to a good estimate. |
| 5 | P1 | **Inferred conversions were invisible.** `CONVERSION_LABEL` (incl. "הערכה מהמאגר") was never rendered, so an estimate looked like a fact. |
| 6 | P1 | **The UI still hid grams.** The picker built its chips from `resolvableUnits()` alone, so for a count-only portion the engine could score 30 גרם that the person could not ask for. |
| 7 | P2 | `unique (household_id, normalized_name)` ignored `is_active`, so archiving a product blocked re-using its name. |
| 8 | P2 | Lint failed on `main` (6 prettier errors from the merge). |
| 9 | P2 | The merge dropped the `points:*` scripts and the `xlsx` devDependency while `scripts/points-reference/source.ts` still imports it. Left alone — out of this task's scope, recorded here. |

**Not found (checked, and correct as delivered):** table grants (`authenticated` has nothing on
`weigh_ins` or `body_privacy`), PUBLIC execute on the internal helpers (properly revoked — the
default-grant trap was handled), bcrypt salting, cross-profile read/write/delete denial, the
`p_profile_id` ownership check on an existing row, and group scoping (`normalizeFoodName` folds only
spelling noise, so variant / brand / raw-cooked / light stay separate groups).

## Fixes made

1. Removed the orphaned block in `dishes.ts`; `main` compiles.
2. `body_unlock` is the only throttled entrance and, on success, opens a ten-minute capability window
   (`body_privacy.unlocked_until`) that every data RPC requires alongside a matching PIN. Added
   `body_lock()`; changing a PIN closes the window. Every SECURITY DEFINER body now names `pg_temp`
   last. Regression test asserts ten wrong PINs at a data RPC cannot get past the counted path.
3. Added a rounding-uncertainty guard: each evidence pair carries ±STEP/2 per row and a pair above
   `MAX_ESTIMATE_UNCERTAINTY` is not evidence. On real data this drops דבש כפית and keeps כף (22.2 g,
   true ≈ 21) and כוס (333 g, true ≈ 340).
4. `describeConversion` + rendering in `DishEditor`: inferred conversions read "הערכה מהמאגר";
   stated and measured ones get a different label.
5. `QuantitySelector` offers direct units plus `convertibleUnits`, and its preview scores with the
   same bridge index it used to build that list.
6. Unique product name enforced on active rows only; archived rows stay to explain old history.
7. `release-preflight` gained `db:private-body-order`, keyed off the two halves so it stops warning
   by itself once the client moves to the RPCs.
8. Formatting of touched files returned to prettier; lint is clean.

## Calculated products — 52 / 2000 evidence

`points_per_gram = 0.026` exactly. Raw, before any rounding: 1000 g = **26**, 500 g = **13**,
300 g = **7.8**. The meal-log boundary is the only rounding point, where 300 g logs as 8. kg and g
entry produce an identical basis. A saved entry keeps its `basis_snapshot`, so editing the product
does not move history. Covered in `dec038-units-calculated.test.ts`.

A zero-point product remains legal: `calculatedServingPoints` handles it and some foods genuinely
score zero. Only the weight must be positive, because dividing by it is what makes the basis.

## Unit conversions — final behaviour

Precedence: same-cell explicit → stored bridge for this exact source identity → coherent same-group
estimate → blocked with the bridge form offered. Explicit "1 כף / 15 גרם" scales directly (30 g →
scale 2) and is recorded as `source_explicit`, never as an estimate. A bridge beats an inference and
the test proves it by value (8 vs 12 points), not by shape. A bridge for another identity is never
applied, proven by asserting its number does not appear. Inference requires: same group, active row,
no rule, not a benefit row, ≥ 1 point, consistent within `INFERENCE_TOLERANCE`, and now within
`MAX_ESTIMATE_UNCERTAINTY` per pair. Inconsistent siblings refuse and fall back to the bridge.

## Private body area — the exact model

The PIN travels on every data call and is re-verified server-side on every call; it is never stored
raw and never persisted to `localStorage`. A successful `body_unlock` writes a ten-minute
server-side capability, so the "unlocked" state the UI would show is backed by real server state
rather than browser state alone. `body_lock()` closes it. Existing `weigh_ins` rows are untouched by
the migration and remain readable by their owner after a PIN is set — asserted in the PGlite suite
against a row inserted *before* the migration runs.

**The user flow does not exist yet.** There is no body area, PIN screen, trend view or progress feed.

## Security proof

All against PGlite with the real migration chain, as `authenticated` with a JWT claim:

- direct `select` / `insert` on `weigh_ins` → `permission denied`; same for `body_privacy`
- `body_check_pin` (internal) → `permission denied`; effective ACLs show internal helpers as
  `postgres=X/postgres` only, so the PUBLIC default is genuinely gone
- `weigh_ins` absent from `pg_publication_tables`
- PIN hash matches `^\$2[aby]\$` and does not contain the PIN
- wrong PIN, and profile B's PIN against profile A, refused for read and write
- profile B cannot overwrite profile A's existing row by id (`body_forbidden`)
- delete is scoped to the owner
- ten wrong PINs at a data RPC cannot escape the lockout; five at `body_unlock` do lock, and the
  lock then closes the data path too
- an expired or explicitly closed window relocks; one profile's window never opens the other's
- another household is `body_forbidden` everywhere

**Browser cache behaviour is NOT yet correct**: `weigh_ins` still flows through the shared store and
sync because the client half is unbuilt. That is issue 3, and it is why the migration must wait.

## Migration review

`20260924090000_calculated_products_private_body.sql` — additive, forward-only, idempotent
(`create table if not exists`, `create or replace function`, `add column if not exists`,
`drop policy if exists`, guarded publication changes). No existing row is read, rewritten or
deleted. FKs: `household_id` cascade, `created_by_profile_id` set-null, `food_entries.calculated_product_id`
set-null so history survives a deleted product. Rollback notes included and updated.

Verified on PGlite via the existing harness (no Docker, no network): **12 tests pass**, including
the pre-migration weigh-in still being readable afterwards. Schema/type parity is now asserted by
`dec038-schema-parity.test.ts`, which caught `body_lock` missing from `database.generated.ts`.

**Not applied to production by this run.**

## Tests

```
bun run typecheck                → 0 errors
bun run lint                     → 0 errors, 9 warnings (pre-existing react-refresh)
bun run test                     → 57 files passed, 3 skipped · 538 passed, 16 skipped
bun run e2e:hermetic             → 10 passed
bun run build                    → OK
bun run preflight -- --env       → PREFLIGHT PASS — 6 checks (1 deliberate warning)
```

Added this run: `dec038-schema-parity.test.ts` (5), `Dec038UnitsUi.test.tsx` (3, two of which fail
without the picker fix — checked by reverting), plus new cases in the PGlite suite (throttle bypass,
capability expiry, `body_lock` grants, archive/name reuse) and in the domain suite (raw 26/13/7.8,
evidence-too-rounded).

## Still not implemented (task sections A and B)

- Calculated product: creation/edit/archive UI, search integration, repository and sync.
- Private body: the whole area — PIN set/unlock, trend windows, progress feed, relock, profile
  switching, and the repository/store changes that take `weigh_ins` out of the shared cache.

These were not started by the Lovable implementation and are not remediation, so this run reports
them rather than half-building them.

## Owner action

**Do not apply migration `20260924090000` and do not publish**, until the private body client path
exists. Nothing else is required.
