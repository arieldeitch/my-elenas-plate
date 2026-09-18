# Task prompt — run of 2026-09-18 (seventh run, M2-6) — verbatim as received; list markers may be normalized by prettier

Continue the Nutrition App directly from the current repository state.

Expected starting point:

`main @ 56793af`

Verify actual branch / HEAD / origin / worktree first.

Do NOT restart takeover.
Do NOT repeat M1 investigation.
Do NOT reopen stable architecture unless current evidence contradicts it.

Read the latest:

- project status;
- TODO;
- decisions;
- M2-5 run record;
- current MealEditor/search implementation.

Then execute.

# CURRENT PRODUCT STATE

M2 currently has:

- compact mobile Home;
- TodayCard;
- PartnerGlance;
- six meal-slot tiles;
- fast quick-add;
- inline quantity stepping for count-style units;
- Day Review;
- explicit ownership;
- compact daily context;
- honest sync state;
- tested mobile/RTL behavior.

The most recent measured friction is now:

Recent/favourite chips add in one tap.

Typed search results still require:

search
→ tap result
→ quantity/default confirmation
→ add

even when the food already has a known usual unit and the user is simply confirming the default.

M2-6 should remove that redundant step.

# PRIMARY MILESTONE

Implement:

# M2-6 — DIRECT ADD FROM SEARCH RESULTS

Goal:

When a user finds an existing food through typed search and that food has a valid usual quantity/unit, tapping the result should add it immediately using that default.

Then the existing inline quantity stepper handles common corrections.

Desired common loop:

Home
→ meal tile
→ type/search
→ tap food
→ food is added
→ optionally + / −
→ finish

No intermediate confirmation screen when it contributes no new information.

Keep the full quantity/custom flow where it is genuinely required.

---

# PHASE 1 — BASELINE

Quickly inspect:

- search result shape;
- food catalog model;
- favourite/recent chip flow;
- existing quick-add helper;
- default quantity/unit fields;
- quantity screen;
- custom-food creation;
- foods lacking valid defaults;
- coffee/special handling;
- duplicate-entry rules;
- save/persistence path.

Identify precisely why search results currently diverge from recent/favourite chips.

Prefer unifying existing behavior rather than creating another code path.

---

# PHASE 2 — DEFINE ELIGIBILITY

A typed search result may direct-add only when the existing data provides enough deterministic information.

Define explicit eligibility.

Likely requirements:

- existing catalog food;
- valid usual quantity;
- valid usual unit;
- no unresolved required field;
- no special workflow that requires additional user input.

Do not guess missing defaults.

If the food is not safely eligible, preserve the existing quantity/detail flow.

The distinction must be deterministic and testable.

---

# PHASE 3 — DIRECT ADD

For eligible search results:

tapping the result should:

1. add the food immediately;
2. use its existing usual quantity/unit;
3. attribute it to the active person;
4. use the selected date;
5. use the current meal slot;
6. use the existing persistence/queue mechanism;
7. surface it immediately in the MealEditor;
8. give subtle confirmation.

Do not create a second persistence mechanism.

Reuse the same path as recent/favourite quick add wherever possible.

---

# PHASE 4 — SEARCH RESULT PRESENTATION

Make search results communicate enough information before the tap.

For eligible items, show the usual quantity/unit inline or as compact secondary text.

Example conceptually:

`ביצה קשה`
`1 יחידה`

The user should understand what tapping will add.

Do not create dense cards.

Do not add explicit "Add" buttons to every row unless interaction testing proves the row itself is unclear.

A tap on the result should ideally remain the action.

For non-direct-add items, visually indicate that tapping opens quantity/details only if necessary.

Avoid confusing two completely different UI styles.

---

# PHASE 5 — FALLBACK CASES

Preserve the existing flow for foods where direct add would be unsafe.

At minimum inspect:

- missing usual unit;
- missing default quantity;
- gram/ml foods with valid default quantity;
- custom foods;
- malformed catalog entries;
- special coffee behavior;
- foods requiring user-entered quantity;
- fractional defaults.

Important:

M2-5 restricted the inline stepper to count units.

M2-6 eligibility does NOT necessarily need to be limited to count units.

If an existing catalog food reliably defines:

`150 g`
or
`250 ml`

then tapping the search result may still safely add that exact usual quantity.

The difference is:

- Direct Add = can the default be trusted?
- Inline Stepper = can +/− semantics be trusted?

Keep these concerns separate.

---

# PHASE 6 — CUSTOM FOOD

Do not harm custom-food creation.

If no catalog result matches and the current product allows creating a custom food:

keep that path explicit.

Do not accidentally interpret "create new" as immediate add with guessed defaults.

If custom-food UX currently requires quantity/unit creation, preserve that requirement.

This run is not a custom-food redesign.

---

# PHASE 7 — DUPLICATE / REPEATED FOOD

Inspect current behavior when the same food is added twice to the same meal.

Do not change the product rule unless necessary.

Possible existing behavior may be:

- two separate rows;
- merge with existing entry;
- other established behavior.

Preserve it.

Direct Add should behave exactly like the current quick-add path.

If duplicate semantics are inconsistent between search and recent/favourite chips, fix the inconsistency using the established product rule.

---

# PHASE 8 — POST-ADD EXPERIENCE

After the tap:

- search should not leave the user confused;
- the new row should be easy to find;
- the user should immediately be able to use the M2-5 stepper;
- search text should behave sensibly;
- keyboard behavior should feel natural.

Inspect whether the best flow is:

A. clear search and show the new entry;
B. keep search open for adding another item;
C. another existing pattern.

Prefer the pattern already proven by recent/favourite quick add.

Do not introduce modal churn.

The user should be able to add multiple foods efficiently.

---

# PHASE 9 — SEARCH RANKING

The previous run specifically found that search ranking itself was NOT the current top friction.

Therefore:

Do NOT broadly redesign search ranking.

Only fix ranking if M2-6 testing exposes an actual correctness problem.

Do not introduce fuzzy-search libraries, new indexes, backend search, AI search or catalog restructuring.

---

# PHASE 10 — TAP COUNT

Measure actual before/after interactions.

Representative cases:

## Existing food with usual count unit

Before:
tile
→ type
→ result
→ confirmation
→ finish

After:
tile
→ type
→ result
→ finish

## Existing food with reliable gram default

Measure whether it can also safely direct-add.

## Food without valid default

Should remain on the existing detail/quantity flow.

Report actual behavior.

---

# PHASE 11 — OWNERSHIP

Regression-test attribution carefully.

Direct-add search results must always land on:

- active person;
- selected date;
- selected slot.

Partner data must remain untouched.

Switching Day Review or PartnerGlance must not affect the MealEditor owner unexpectedly.

Ownership must remain as explicit as M2-4/M2-5 established.

---

# PHASE 12 — SAVE / SYNC

Use the current durable queue.

Verify:

- one direct-add = one intended entry operation;
- no duplicate save due to result click + form handler;
- optimistic row appears immediately;
- sync indicator remains honest;
- offline behavior works through existing queue;
- errors do not silently lose the entry.

Do not create special search-save semantics.

---

# PHASE 13 — KEYBOARD / MOBILE UX

This change happens while typing, so inspect keyboard behavior.

On mobile:

- search input remains usable;
- result remains tappable above the keyboard;
- direct add does not unexpectedly close the entire meal editor;
- scrolling stays sane;
- after adding one item, adding another is easy.

Test at:

- 412×915;
- 360×740.

No horizontal overflow.

Check actual browser RTL.

---

# PHASE 14 — ACCESSIBILITY

Verify:

- search results have meaningful accessible names;
- usual quantity is conveyed;
- eligible direct-add result clearly behaves as an action;
- fallback result does not misleadingly announce immediate addition;
- confirmation is accessible but not noisy;
- keyboard navigation still works where supported.

Fix only relevant issues.

---

# PHASE 15 — TESTS

Add deterministic coverage.

At minimum:

1. eligible catalog food direct-adds on result tap;
2. usual quantity/unit is used;
3. count-unit item immediately supports M2-5 stepper;
4. gram/ml item uses its defined default if valid;
5. missing-default item opens existing quantity/detail flow;
6. custom-food flow unchanged;
7. active person/date/slot attribution correct;
8. partner untouched;
9. repeated addition obeys current duplicate rule;
10. offline/pending queue behavior preserved;
11. no duplicate write;
12. search result quantity/unit display;
13. mobile browser quick flow.

Update hermetic browser coverage with a realistic:

meal tile
→ type food
→ tap result
→ optional +
→ finish
→ Day Review verifies final amount.

Do not weaken existing tests.

---

# PHASE 16 — VISUAL PRODUCT CHECK

Inspect the MealEditor as a complete experience.

The search area should now feel like a true quick-entry tool.

Avoid turning results into bulky cards.

Primary visual hierarchy:

1. search;
2. useful matching foods;
3. tap to add;
4. logged meal entries;
5. quick quantity correction.

The interaction should feel obvious without explanation.

---

# M1

M1 remains YELLOW unless owner production actions have actually occurred.

Do not reinvestigate owner access.

Do not alter M1 release tooling.

Mention it briefly only.

---

# LOCAL PHONE DATA

No migration.
No deletion.
No import.

M1-R5 remains pending.

Do not work on it.

---

# DO NOT ADD

Do not add:

- AI search;
- barcode scanner;
- nutrition calculations;
- calorie/protein logic;
- new food taxonomy;
- backend search;
- realtime;
- notifications;
- social features;
- new database tables.

This milestone is removal of one redundant interaction.

---

# GIT

Use coherent commits.

Before push:

- inspect diff;
- remove debug artifacts;
- verify no secrets;
- run relevant tests;
- production build green.

Push completed green work to main.

No force-push.

---

# DOCUMENTATION

Use the existing repo-native system.

Save/update:

- run prompt;
- run report;
- project status;
- TODO;
- decisions if a durable product rule was established;
- canonical last-run timestamp.

Avoid redundant docs.

---

# IF M2-6 FINISHES EARLY

Do NOT immediately add another feature.

Perform a short friction scan of the now-complete main daily loop:

Home
→ choose meal
→ find food
→ add
→ adjust quantity
→ finish
→ Day Review.

Measure the next largest avoidable interaction cost.

Potential candidates:

- repeat entire previous meal;
- better recent-food ordering;
- editing/removing mistakes;
- switching dates;
- frequently repeated combinations;
- custom food creation.

Select ONE M2-7 milestone based on observed use, not speculation.

If there is no clearly dominant friction left, say so and recommend moving to real-device validation rather than manufacturing another feature.

---

# SUCCESS CRITERIA

This run succeeds when:

1. existing foods with trustworthy defaults add directly from search;
2. redundant quantity confirmation disappears;
3. fallback remains safe for foods needing input;
4. usual quantity is visible before tapping;
5. quick-add + stepper form one coherent flow;
6. attribution remains correct;
7. no duplicate writes occur;
8. mobile keyboard/RTL UX remains clean;
9. tests/build remain green;
10. work is pushed.

---

# REQUIRED FINAL REPORT

Use exactly:

## STATUS

Overall plus:

- M1
- M2
- repository

## STARTING STATE

Branch, SHA, origin/worktree.

## FRICTION BEFORE

Measured typed-search flow before M2-6.

## M2-6 IMPLEMENTED

Exactly what changed.

## DIRECT-ADD RULE

Which search results direct-add and which fall back.

## SEARCH RESULT UX

What the user sees before tapping.

## QUICK FLOW

Before/after interaction counts for representative foods.

## FALLBACKS

Missing defaults, custom foods, special cases.

## OWNERSHIP

Person/date/slot behavior.

## SAVE / SYNC

Writes, queue behavior, duplicate protection.

## MOBILE / KEYBOARD / RTL

412×915 and 360×740 findings.

## ACCESSIBILITY

Relevant findings only.

## PERFORMANCE

Only observed findings.

## M1

Concise current state.

## TESTS

Exact results.

## GIT

Ending SHA(s), branch, push state.

## DOCUMENTATION

Exact files.

## YOU

Only genuine owner actions.

## NEXT

ONE evidence-based M2-7 milestone, or explicitly recommend real-device validation if daily-loop friction is now sufficiently low.

## RUN TIMESTAMP

Exact local date/time and update canonical last-run timestamp.

Work autonomously.
Do not stop because production M1 remains owner-blocked.
