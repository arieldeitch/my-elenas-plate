# Run record — 2026-09-18 (seventh run) — M2-6 direct add from search results

**Objective:** remove the redundant quantity confirmation when a typed search result already has a
trustworthy usual quantity; unify chips and results on one path; keep the quantity screen where input
is genuinely needed. Prompt: `RUN_2026-09-18_M2_6_DIRECT_ADD.prompt.md`. Decision: DEC-030.

**Outcome:** `GREEN` for M2-6 and the repository; M1 unchanged (`YELLOW`, owner actions).

## 1. Starting state

`main` @ `56793af`, clean, = `origin/main`.

## 2. Baseline (Phase 1) — why results diverged from chips

- Search results (`FoodSearch` → `onPick`) always opened `QuantitySelector`; chips (`onQuickAdd`) added
  `amount: 1, unit: food.defaultUnit` immediately. Two code paths, two rules.
- `Food.defaultUnit` = the **first unit of the food's unit set** (`src/data/foods/types.ts`); the catalog
  defines a unit _order_ per food but **no default amount**. Sets exist whose first unit is weight or
  volume (`grams`, `meat`, `gramsCup`, `nuts`, `sweetG`, `ml`, `water`) — קוטג׳, חזה עוף, מים… For
  those, "1 × defaultUnit" is "1 גרם"/"1 מ״ל": not a usual quantity. **The chip path was therefore
  already wrong for weight-first foods** (it would have logged "1 גרם קוטג׳"); M2-6 fixes it together
  with the results.
- Custom foods: created through "כמאכל חדש" → quantity screen; `addFood` gives them `defaultUnit:
"יחידה"`. Coffee: own editor. Duplicate rule: a second add = a second row. Save: `store.addEntry` →
  `entry.upsert` in the durable queue (idempotent by id).
- Friction before (typed food with a count unit): tile → type → result → **"הוספת המאכל"** → סיום.

## 3. M2-6 implemented (`7da1a3d`)

| Piece       | Detail                                                                                                                                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eligibility | `lib/quantity.usualQuantity(food)` → `{ amount: 1, unit }` only when `defaultUnit` is a count unit (יחידה, חצי יחידה, כף, כפית, כוס, ספל, פרוסה, קערה, מנה) and the food is not coffee; otherwise `null`. Deterministic, unit-tested.        |
| One path    | `MealEditor.handleChoose(food)`: coffee → coffee editor; no usual quantity → quantity screen; otherwise `store.addEntry` (active person, selected date, this slot), highlight, toast. Returns `"added"` / `"opened"`.                        |
| FoodSearch  | Single `onChoose` prop for chips and results. Result rows show a pill: green "+ 1 יחידה" (direct) or muted "בחירת כמות" / "סוג וחלב" (fallback). Accessible names: "ביצה קשה, הוספה של 1 יחידה" vs "קוטג׳, פתיחת בחירת כמות". `data-direct`. |
| Post-add    | After `"added"` the query clears and the input keeps focus → new row highlighted with − / +, chips visible again, next item immediate (the proven chip pattern).                                                                             |
| Unchanged   | Custom-food creation (quantity screen, explicit); duplicate rule (second row); pencil → full editor; Day Review untouched.                                                                                                                   |
| Tests       | `usualQuantity` (2); editor contract rewritten to direct add (5) + boundaries: custom food, weight-first chip (2); M2-5 highlight test adjusted; hermetic e2e helpers/specs ported (`pickSearchResult` confirms only when the screen opens). |

## 4. Direct-add rule (DEC-030)

Direct add when: existing food (catalog or custom) **and** `defaultUnit` ∈ count units **and** not
coffee. Fallback to the quantity screen when: `defaultUnit` is גרם/ק״ג/מ״ל/ליטר (no trusted amount
exists — nothing is guessed), no `defaultUnit`, or coffee. Custom-food _creation_ always goes through
the quantity screen. "Can the default be trusted" (this rule) is kept separate from "can +/− be
trusted" (DEC-029); today both resolve to count units only because the model has no default amount —
a future per-food usual amount (e.g. 150 גרם) could enable direct add without touching the stepper.

## 5. Quick flow — measured taps after opening the tile

| Food                          | Before                                  | After                                                                                    |
| ----------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| ביצה קשה (count unit, typed)  | type → result → הוספת המאכל → סיום = 3  | type → result → סיום = **2**                                                             |
| 2 × ביצה קשה                  | 3 + pencil/quantity                     | type → result → + → סיום = **3**                                                         |
| קוטג׳ (weight-first, 150 גרם) | type → result → amount → unit → confirm | unchanged (no trusted default)                                                           |
| Recent chip                   | 1 (already)                             | 1 — and now correct for weight-first foods (opens the screen instead of logging "1 גרם") |
| Custom food                   | name → כמאכל חדש → quantity → confirm   | unchanged                                                                                |

## 6. Ownership, save, sync

Attribution comes from the store's `addEntry` (active profile, selected date, slot) — identical to
chips; tests assert the partner's day stays empty. One tap = one `entry.upsert` (no form handler
runs after a direct add; the `"added"` return only clears the search box). Optimistic row; "מסונכרן"
only after confirmation; offline through the existing queue.

## 7. Mobile / keyboard / RTL (screenshots `test-results/home-m26`, 412×915 and 360×740)

Result rows: name + category on the right, pill on the left, no overflow at 360px; direct vs fallback
distinguishable by text and icon, not colour alone. After a direct add: search cleared and focused,
highlighted row with − / +, coffee shortcut and recents visible, "סיום" fixed at the bottom — the
sheet does not close. RTL order of "+ 1 יחידה" correct.

## 8. Accessibility

Result and chip names state the outcome of the tap; fallback rows never announce an add; the pill is
`aria-hidden` (its content is in the name); toast is short and passive; keyboard: Enter on a focused
result triggers the same `onChoose`.

## 9. Performance

No new reads; one write per add; no measurable render change.

## 10. M1 / local phone data

Unchanged; `M1_RELEASE_ACCEPTANCE.md` remains the procedure.

## 11. Tests

| Check                                                  | Result                                         |
| ------------------------------------------------------ | ---------------------------------------------- |
| `bun run typecheck`                                    | 0 errors                                       |
| `bun run lint`                                         | 0 errors, 8 pre-existing warnings              |
| `bun run test`                                         | **301 passed**, 15 skipped (gated live suites) |
| `npx playwright test -c playwright.hermetic.config.ts` | **8 passed**                                   |
| `npx vite build`                                       | OK                                             |

## 12. M2-7 friction scan (measured on the loop as it now is)

tile (1) → chip/result (1 + typing) → optional + (1) → סיום (1) → review (1). Delete = trash + undo
(1); dates = prev/next/calendar; recents by last use. The only step above one tap is entering an
amount for weight-first foods, and default amounts would be guesses (DEC-030). **No dominant friction
is measurable from here.** → M2-7: real-device validation by both partners once the M1 owner actions
land, with a short observed-friction log driving M2-8 (candidates to watch: repeat yesterday's meal,
weight-first amounts).

## 13. Git

`main`: `56793af` → `7da1a3d` (M2-6) → docs commit (this file). Pushed to `origin/main`.

---

# FINAL REPORT

## STATUS

Overall: `GREEN`.

- **M1:** `YELLOW` — unchanged; owner actions pending (`M1_RELEASE_ACCEPTANCE.md`).
- **M2:** `GREEN` — M2-6 done; the daily loop is one tap per step; M2-7 = real-device validation.
- **Repository:** `GREEN` — all gates pass; pushed.

## STARTING STATE

`main` @ `56793af`, clean worktree, equal to `origin/main`.

## FRICTION BEFORE

A typed count-unit food: type → result → "הוספת המאכל" (confirming the default only) → סיום = 3 taps
after the tile. Chips were 1 tap — but would have logged "1 גרם" for weight-first foods.

## M2-6 IMPLEMENTED

One choose path for chips and results (`handleChoose`/`onChoose`); `usualQuantity` eligibility;
result rows show the outcome of a tap; search clears and keeps focus after a direct add; custom-food
creation, duplicate rule, pencil and Day Review unchanged; tests and hermetic specs ported.

## DIRECT-ADD RULE

Direct add: existing food with a count-unit `defaultUnit`, not coffee. Fallback (quantity screen):
weight/volume-first foods (גרם, ק״ג, מ״ל, ליטר), no unit, coffee (own editor), custom-food creation.
Nothing is guessed.

## SEARCH RESULT UX

Name + category, then a pill: "+ 1 יחידה" (green, direct) or "בחירת כמות" / "סוג וחלב" (muted,
fallback); accessible names spell it out.

## QUICK FLOW

ביצה קשה typed: 3 → **2** taps; 2 eggs typed: → 3; קוטג׳ (150 g): unchanged; chips: 1 (now correct for
weight-first foods); custom food: unchanged.

## FALLBACKS

Weight-first and unit-less foods → quantity screen; coffee → coffee editor; custom creation →
quantity screen; chips for weight-first foods → quantity screen (fixed inconsistency).

## OWNERSHIP

Same `addEntry` path as chips: active person, selected date, current slot; partner untouched (tested).

## SAVE / SYNC

One `entry.upsert` per tap, no double handler; optimistic; queue/offline/error states unchanged.

## MOBILE / KEYBOARD / RTL

412×915 and 360×740: rows compact, no overflow, pill readable; after an add the sheet stays open,
search cleared and focused, new row highlighted with − / +; RTL order correct.

## ACCESSIBILITY

Result/chip names state the outcome ("הוספה של 1 יחידה" vs "פתיחת בחירת כמות"); pills are
decorative; fallbacks never announce an add.

## PERFORMANCE

No new reads; one write per add.

## M1

Unchanged; production closure waits on the owner's three actions.

## TESTS

typecheck 0 · lint 0/8 · vitest 301 passed / 15 skipped · hermetic Playwright 8/8 · build OK.

## GIT

`main` @ the docs commit after `7da1a3d` (see `git log`), pushed to `origin/main`; no history rewrite.

## DOCUMENTATION

`docs/claude-tasks/RUN_2026-09-18_M2_6_DIRECT_ADD.md` (+ `.prompt.md`), `docs/decisions.md` (DEC-030),
`docs/todo.md`, `docs/project-status.md`, `docs/claude-context.md`.

## YOU

The three M1 owner actions in `M1_RELEASE_ACCEPTANCE.md` §1, and the M1-R5 decision on phone-local
demo data.

## NEXT

**M2-7 — real-device validation instead of another feature.** Every step of the daily loop is now
one tap (the only exception, typing an amount for weight-first foods, cannot be removed without
guessing). Once the owner actions land: three days of real use by both partners on their phones with a
short observed-friction log; M2-8 is chosen from that log.

## RUN TIMESTAMP

2026-09-18 13:16 local time (Israel Standard Time), on the second computer.
