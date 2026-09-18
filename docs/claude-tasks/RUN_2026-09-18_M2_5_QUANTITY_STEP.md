# Run record — 2026-09-18 (sixth run) — M2-5 one-tap quantity adjustment

**Objective:** after a quick add, change the common quantity (2 eggs, 2 slices) without leaving the
logging flow — − / + on the row, deterministic and safe, using the existing persistence path.
Prompt: `RUN_2026-09-18_M2_5_QUANTITY_STEP.prompt.md`. Decision: DEC-029.

**Outcome:** `GREEN` for M2-5 and the repository; M1 unchanged (`YELLOW`, owner actions).

## 1. Starting state

`main` @ `1d25473`, clean, = `origin/main`.

## 2. Baseline (Phase 1)

- `FoodEntry` quantity: `mode: "measured"` → `{ amount: number, unit: Unit }`, or `mode: "subjective"`
  → one of מעט/במידה/הרבה/מוגזם. Units: 13 (`ALL_UNITS`): weight/volume (גרם, ק״ג, מ״ל, ליטר) and
  nine count-like (יחידה, חצי יחידה, כף, כפית, כוס, ספל, פרוסה, קערה, מנה). Coffee entries are
  measured with `COFFEE_UNITS` + a `coffee` summary.
- No increment/decrement helper existed. Quick add wrote `amount: 1, unit: defaultUnit`; the row
  showed `"1 יחידה"` (no plural); correction = pencil → `QuantitySelector` → confirm.
- Save path: `store.updateEntry(slot, entry)` → optimistic `mutateDay` + `entry.upsert` in the
  durable queue. **The queue already coalesces by `entry:<id>`** (`queue.enqueue` replaces the pending
  op in place; `drain` re-reads each step), so no new debounce mechanism was needed — only proof.

## 3. M2-5 implemented (`aab380e`)

| Piece          | Detail                                                                                                                                                                                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/quantity` | `COUNT_UNITS`, `canStep(entry)`, `stepAmount(entry, ±1)` (step 1, fractions kept, `null` below 1), `formatQuantity` with Hebrew plurals ("2 יחידות", "3 פרוסות", "1,5 כוסות"; 1 singular; other units unchanged).                                                             |
| Entry row      | Two lines: name + star / pencil / trash (labels include the food); then a pill `− 2 יחידות +` for count units (`role="group"` "כמות של <food>", `aria-live` value, − disabled at the floor) or plain text for grams / subjective. Coffee keeps its summary and steps in cups. |
| Quick add      | The new row is highlighted (border + soft tint) so "+ once" needs no hunting; the toast is a plain "נוסף: <food> · 1 יחידה" (2.5 s, no action). The pencil still opens the full editor.                                                                                       |
| Save / sync    | `updateEntry` → `entry.upsert`; rapid taps collapse to **one pending op with the final amount and one write** (cloud-path test). Optimistic UI; "מסונכרן" only after confirmation; failures keep the existing pending/error states.                                           |
| Day Review     | Uses `formatQuantity` for consistency; **no steppers** (review stays read-only; pencil → editor).                                                                                                                                                                             |

## 4. Stepper rules (DEC-029)

Count units step by 1 and never below 1 (`1 → 0` is refused; the trash is the only delete). Fractions
survive (1.5 → 2.5; 0.5 cannot decrement). Weight/volume units, subjective amounts and malformed
entries show text and keep the full editor — no invented step semantics. Coffee in cups/mugs steps.

## 5. Quick-add flow — measured taps (after opening the tile)

| Case                         | Before                                                          | After                                    |
| ---------------------------- | --------------------------------------------------------------- | ---------------------------------------- |
| 2 eggs (recent chip)         | tile → chip → pencil → quantity screen → confirm → סיום = **6** | tile → chip → **+** → סיום = **4**       |
| 3 slices (recent chip)       | 6 (typing "3")                                                  | tile → chip → + → + → סיום = **5**       |
| 2 cups of coffee (fast path) | tile → קפה מהירה → הוספת הקפה → pencil → coffee editor → …      | tile → קפה מהירה → הוספת הקפה → + → סיום |
| 150 g of rice                | unchanged (quantity screen)                                     | unchanged — by design                    |

## 6. Edge cases (unit + browser tests)

quantity 1 → + → 2 → − → 1 → − disabled; repeated + → 5; fractions 1,5 → 2,5 → 1,5 → − disabled; grams,
subjective → no stepper; coffee → stepper + summary; long name truncates on line 1 (pill on line 2, no
overflow — asserted); rapid taps → one pending op, one write, final amount; offline/pending → existing
queue states; reload → persisted amount (demo persistence in tests, cloud path via the fake).

## 7. Mobile / RTL (screenshots `test-results/home-m25`, 412×915 and 360×740)

Rows with short and long names, grams, coffee and a 3-unit egg: readable, no horizontal overflow; the
pill sits on the second line at the control side; the just-added row is highlighted; "3 יחידות",
"1 כוס", "1 גרם" render in the correct order. The editor did not become an accounting table — plain
rows stay plain.

## 8. Accessibility

"עוד <food>" / "פחות <food>" names; disabled minus is a real `disabled` control (not colour); value
region is `aria-live="polite"`; group label "כמות של <food>"; targets 40×44px; star/pencil/trash now
name the food. axe unchanged (row lives inside the tested editor).

## 9. Performance

Three taps → three optimistic renders (one per tap), one queued op, one Supabase write. No flicker;
no duplicate queue records (existing coalesce key).

## 10. M1 / local phone data

Unchanged; `M1_RELEASE_ACCEPTANCE.md` remains the procedure; nothing touched phone-local data.

## 11. Tests

| Check                                                  | Result                                         |
| ------------------------------------------------------ | ---------------------------------------------- |
| `bun run typecheck`                                    | 0 errors                                       |
| `bun run lint`                                         | 0 errors, 8 pre-existing warnings              |
| `bun run test`                                         | **297 passed**, 15 skipped (gated live suites) |
| `npx playwright test -c playwright.hermetic.config.ts` | **8 passed** (new: `quantity-step.spec.ts`)    |
| `npx vite build`                                       | OK                                             |

## 12. M2-6 discovery (measured on the loop as it now is)

Chip adds and corrections are 1 tap each. The one redundant tap left in the common path is the
"הוספת המאכל" confirm after a **typed search result**, which now only ever confirms "1 × usual unit"
— exactly what the row stepper can fix afterwards. Typed food today: type + result + confirm + סיום =
3 taps; without the confirm: 2. Search ranking itself is fine (prefix-first; catalog names are
specific, e.g. "ביצה קשה"). → **M2-6: add search results with the usual unit immediately**, keeping
the quantity screen for foods without a usual unit, custom-food creation and the pencil. Not
implemented here: it rewrites an established contract in ~10 tests/e2e helpers.

## 13. Git

`main`: `1d25473` → `aab380e` (M2-5) → docs commit (this file). Pushed to `origin/main`.

---

# FINAL REPORT

## STATUS

Overall: `GREEN`.

- **M1:** `YELLOW` — unchanged; owner actions pending (`M1_RELEASE_ACCEPTANCE.md`).
- **M2:** `GREEN` — M2-5 done; M2-6 selected.
- **Repository:** `GREEN` — all gates pass; pushed.

## STARTING STATE

`main` @ `1d25473`, clean worktree, equal to `origin/main`.

## FRICTION BEFORE

A quick-added food was always "1 × usual unit"; correcting it meant pencil → quantity screen →
confirm (3 extra taps), and the row showed "2 יחידה" without a plural.

## M2-5 IMPLEMENTED

`− / quantity / +` pill on count-unit rows of the meal editor; `lib/quantity` step + format helpers;
two-line rows with food-named actions; highlighted just-added row and a plain toast; Day Review reuses
the formatting without steppers; tests (11 new) and a browser path; coalescing proven.

## STEPPER RULES

Count units (יחידה, חצי יחידה, כף, כפית, כוס, ספל, פרוסה, קערה, מנה): step 1, fractions kept, floor 1,
− disabled at the floor, never deletes. Weight/volume (גרם, ק״ג, מ״ל, ליטר), subjective and malformed
quantities: text only, full editor via pencil — no invented step semantics. Coffee in cups steps.

## QUICK-ADD FLOW

2 eggs: 6 → **4** taps (tile → chip → + → סיום). 3 slices: 6 → 5. 2 coffees: coffee editor detour →
one +. Grams unchanged by design.

## SAVE / SYNC

Existing `updateEntry` → `entry.upsert` path; optimistic; rapid `+++` collapses in the durable queue
to one pending op with the final amount and one Supabase write (asserted in `cloud-path.test`);
"מסונכרן" only after confirmation; failures keep the honest pending/error states.

## EDGE CASES

Floor never deletes; fractions preserved; grams/subjective fall back; coffee steps with its summary;
long names truncate on line 1; reload keeps the amount; offline uses the existing queue.

## MOBILE / RTL

412×915 and 360×740: rows readable, no overflow, pill on the second line, correct number/unit order,
highlighted new row. The editor stays calm — only count-unit rows show controls.

## ACCESSIBILITY

Food-named −/+ (and star/pencil/trash), real `disabled` at the floor, live value region, group label,
40×44px targets.

## PERFORMANCE

One render per tap, one queued op, one write; no duplicates, no flicker.

## DAY REVIEW

No steppers added; it only gained the same plural formatting. Pencil → editor unchanged; partner
review still read-only.

## M1

Unchanged; production closure waits on the owner's three actions.

## TESTS

typecheck 0 · lint 0/8 · vitest 297 passed / 15 skipped · hermetic Playwright 8/8 · build OK.

## GIT

`main` @ the docs commit after `aab380e` (see `git log`), pushed to `origin/main`; no history rewrite.

## DOCUMENTATION

`docs/claude-tasks/RUN_2026-09-18_M2_5_QUANTITY_STEP.md` (+ `.prompt.md`), `docs/decisions.md` (DEC-029),
`docs/todo.md`, `docs/project-status.md`, `docs/claude-context.md`.

## YOU

The three M1 owner actions in `M1_RELEASE_ACCEPTANCE.md` §1, and the M1-R5 decision on phone-local
demo data.

## NEXT

**M2-6 — add search results with the usual unit immediately** (like a chip), keeping the quantity
screen only for foods without a usual unit, custom-food creation and the pencil. Measured: typed food
3 taps → 2; the confirm now only ever confirms the default the stepper can fix.

## RUN TIMESTAMP

2026-09-18 12:35 local time (Israel Standard Time), on the second computer.
