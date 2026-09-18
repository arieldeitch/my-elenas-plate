# Run record — 2026-09-18 (fourth run) — M2-3 compact daily context row

**Objective:** quiet the secondary blocks — fold the fixed weigh-in banner and the workout/fasting
cards into one compact row under the meal tiles; re-inspect the whole home on two phone viewports;
keep the quick-log loop, ownership and sync honest; leave M1 and phone-local data untouched.
Prompt: `RUN_2026-09-18_M2_3_CONTEXT_ROW.prompt.md`. Decision: DEC-027.

**Outcome:** `GREEN` for M2-3 and the repository; M1 closure unchanged (`YELLOW`, owner actions).

## 1. Starting state

`main` @ `fc43065`, clean, = `origin/main`. Same portable toolchain as the previous runs.

## 2. Home before (measured with `scripts/home-snapshots.mjs`, hermetic dev server)

Pixel 7 (412×915, fold 839 CSS px): header 0–137 · today 137–274 · partner 286–350 · tiles 366–705 ·
then a **fixed weigh-in banner floating over the tiles**, a full workout card (toggle + chip groups) and a
full fasting card (three stat boxes + editor) → **page height 1373px**. Secondary context ≈ 40% of the
page, all of it editors sitting permanently on the home.

## 3. M2-3 implemented (`4d50765` + polish commit)

| Change            | Detail                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DailyContextRow` | One card, three equal cells: **שקילה** (latest kg, "היום"/date, signed delta with arrow), **אימון** (type + feeling), **צום** (hours + `HH:mm–HH:mm`). Absent → "לא תועד" / "—" in muted weight, plus "הוספת שקילה" as the only nudge. `aria-label` carries the state ("שקילה: 64.2 ק״ג, נשקל היום. פתיחת טופס שקילה"). |
| Interaction       | Weight cell → existing `WeighInForm`. Workout / fasting cells → inline panel below the row (`aria-expanded`), one at a time, folded on person/date change and after save/clear. Panel close target 40px.                                                                                                                |
| Editors           | `WorkoutCard` → `WorkoutEditor` (כן / לא / עוד לא תועד → type + feeling chips); `FastingCard` → `FastingEditor` (two time inputs, computed duration, שמירה / ניקוי). Rules and data unchanged.                                                                                                                          |
| Removed           | `WeightBanner` (fixed), `WorkoutCard`, `FastingCard` and their tests (intent ported to `DailyContextRow.test.tsx`).                                                                                                                                                                                                     |
| Header            | `SyncStatus` moved beside the brand (the separate sync line is gone); page bottom padding reduced now that nothing floats above the nav.                                                                                                                                                                                |
| Tooling           | `scripts/home-snapshots.mjs`: Playwright, hermetic, two viewports × four day states → screenshots + page height + above-the-fold report (`test-results/…`, git-ignored).                                                                                                                                                |
| Tests             | `DailyContextRow.test.tsx` (6), a11y case, hermetic `e2e/hermetic/daily-context.spec.ts`; cloud-path M2 test now bounds day reads (≤ 3 `food_entries` selects on activation — no refetch loop); `device-profile.spec` fixed (see §9).                                                                                   |

## 4. Home after

Pixel 7: header 0–105 · today 105–242 · partner 254–318 · tiles 334–673 · **context row 685–755** ·
runtime notice · nav → **page height 981px (−392px)**. In every captured state (empty, partial, full,
partner view) all four primary blocks are above the 839px fold. 360×740: same order, tiles end at
673, the context row starts at the fold (partly visible without scrolling); labels wrap inside tiles,
no horizontal scroll.

## 5. Secondary status behaviour

- **Weight:** "72.4 ק״ג · היום" when today's weigh-in exists; "72.4 ק״ג · 12.9.2026" otherwise; "— ·
  הוספת שקילה" when none. Delta "−0.6" (arrow + sign) only when a previous weigh-in exists. Tap → form.
- **Workout:** "ריצה · טוב" / "לא בוצע" / "לא תועד". Tap → inline editor.
- **Fasting:** "16 שעות · 20:00–12:00" / "לא תועד". Tap → inline editor with the saved window prefilled.
- No timers, streaks, warnings or red states; nothing invented beyond the existing day model.

## 6. Daily loop

Unchanged from M2-2 (tile → chip → סיום). Verified again in the browser: after "סיום" the tile shows
"תועד" with a check, the today card count and "לאחרונה: …" update, and the toast is the only transient.
No further change was warranted.

## 7. Partner experience

Unchanged wording ("לאחרונה: <food> · <slot> · <time>"); the partner card additionally shows the
fasting window and workout mark now that both are one tap to record. Verified in the hermetic loop:
Elena's fasting + workout appear on Ariel's partner card; Ariel's own row stays empty.

## 8. RTL / mobile / accessibility (browser-verified at 3× zoom)

`1/6 ארוחות`, `20:00–12:00`, `−0.6`, `18.9.2026` all render in the correct order; dots follow slot order
right-to-left; long names truncate. Cell targets ≥ 64px tall × one third of the row; icon-only controls
labelled; status is text, never colour-only. Fixed under RTL: `divide-x` rendered only one of the two
cell dividers — replaced by logical `border-s` on siblings.

## 9. Test hygiene finding

`device-profile.spec` "changed from the switcher" was flaky **by construction**: it seeded the device
key with `addInitScript`, which re-runs on the final `reload()` and re-applied "elena". It passed only
when hydration was slower than the assertion. Now seeds once via `evaluate`; 8/8 repeats pass.

## 10. Performance (observed)

Demo mode: no network. Cloud path (fake-backed test): activation performs one day load per person and
nothing repeats; asserted ≤ 3 `food_entries` reads. Switching date/person triggers one hydrate for the
active person plus one partner day read (existing behaviour); no visible flicker in the screenshots.

## 11. M1 / local phone data

Unchanged. `M1_RELEASE_ACCEPTANCE.md` remains the release procedure; no owner action landed; nothing
touched phone-local data.

## 12. Tests

| Check                                                  | Result                                         |
| ------------------------------------------------------ | ---------------------------------------------- |
| `bun run typecheck`                                    | 0 errors                                       |
| `bun run lint`                                         | 0 errors, 8 pre-existing warnings              |
| `bun run test`                                         | **276 passed**, 15 skipped (gated live suites) |
| `npx playwright test -c playwright.hermetic.config.ts` | **6 passed** (device-profile ×8 repeats: 8/8)  |
| `npx vite build`                                       | OK                                             |
| hosted-branch e2e                                      | not runnable here (unchanged contracts kept)   |

## 13. Git

`main`: `fc43065` → `4d50765` (M2-3) → polish/docs commits (see `git log`). Pushed to `origin/main`.

---

# FINAL REPORT

## STATUS

Overall: `GREEN`.

- **M1:** `YELLOW` — unchanged; owner actions pending (`M1_RELEASE_ACCEPTANCE.md`).
- **M2:** `GREEN` — M2-3 done; M2-4 selected.
- **Repository:** `GREEN` — all gates pass; pushed.

## STARTING STATE

`main` @ `fc43065`, clean worktree, equal to `origin/main`.

## HOME BEFORE

Two person cards and six tiles, then a fixed weigh-in banner floating over the tiles and two full
workout/fasting editor cards. Pixel 7 page height **1373px**; secondary context ≈ 40% of the page.

## M2-3 IMPLEMENTED

`DailyContextRow` (weight · workout · fasting) under the tiles with inline editors on demand;
`WeightBanner`, `WorkoutCard`, `FastingCard` removed; sync status folded into the header;
`scripts/home-snapshots.mjs`; tests and hermetic spec; flaky device-profile spec fixed at its root.

## SECONDARY STATUS

Weight: latest value + when + signed delta, tap opens the existing form; "— · הוספת שקילה" when none.
Workout: type + feeling / "לא בוצע" / "לא תועד", inline editor. Fasting: hours + window / "לא תועד",
inline editor. Absent states are muted text; nothing nags, no red, no streaks.

## HOME AFTER

First screen on Pixel 7: identity + day, my day (count, bar, latest), partner (dots, latest,
fasting/workout), all six slots, the context row, FAB + nav. Page height **981px** (−392px); all four
primary blocks above the fold in every day state. 360×740: same, context row at the fold.

## DAILY LOOP

Unchanged (tile → chip → סיום); verified the post-save home state reads correctly. No change needed.

## PARTNER EXPERIENCE

No regression; fasting/workout now reach the partner card more easily because recording them is one
tap away. Wording unchanged and human ("לאחרונה: …").

## RTL / MOBILE

412×915: everything primary above the fold; 360×740: labels wrap, no horizontal scroll, row at the
fold. Numbers, times and the fraction render in the correct order (verified at 3×). One RTL rendering
bug found and fixed (missing cell divider under `divide-x`).

## ACCESSIBILITY

Cells ≥ 64px targets with state in their accessible names; panel close enlarged to 40px; status never
colour-only; a11y (axe) test covers the row.

## PERFORMANCE

No loops observed; cloud-path test now asserts ≤ 3 day reads on activation. Nothing else to report.

## M1

Unchanged: implementation and tooling complete, production closure waits on the owner's key line +
publish and the grants SQL; `docs/claude-tasks/M1_RELEASE_ACCEPTANCE.md` is the procedure.

## TESTS

typecheck 0 · lint 0/8 · vitest 276 passed / 15 skipped · hermetic Playwright 6/6 (+ 8/8 repeats of
the fixed spec) · build OK.

## GIT

`main` @ the docs commit after `4d50765` (see `git log`), pushed to `origin/main`; no history rewrite.

## DOCUMENTATION

`docs/claude-tasks/RUN_2026-09-18_M2_3_CONTEXT_ROW.md` (+ `.prompt.md`), `docs/decisions.md` (DEC-027),
`docs/todo.md`, `docs/project-status.md`, `docs/claude-context.md`.

## YOU

The three M1 owner actions in `docs/claude-tasks/M1_RELEASE_ACCEPTANCE.md` §1 (key line in
`.env.production` → Publish → grants SQL), and the M1-R5 decision on phone-local demo data.

## NEXT

**M2-4 — day review:** tapping the today card's count (or a tile's status pill) opens a read-only list
of everything logged that day per slot — mine and my partner's — with an edit shortcut per row.
Observed friction: the only way to see what is inside a slot is to open it (six tiles = six taps), the
home shows only the latest item, and "היסטוריה" opens the calendar only.

## RUN TIMESTAMP

2026-09-18 11:45 local time (Israel Standard Time), on the second computer.
