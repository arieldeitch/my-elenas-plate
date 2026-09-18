# Task prompt — run of 2026-09-18 (fourth run, M2-3) — verbatim as received; list markers may be normalized by prettier

Continue the Nutrition App project directly from the current repository state.

Expected starting point:

`main @ fc43065`

Verify the actual repository state before changing anything, but DO NOT restart takeover/discovery.

Read:

- latest project status;
- latest M2 run record;
- current decisions;
- current TODO;
- M1 release acceptance checklist.

Then execute.

# CURRENT TRUTH

The previous run finished GREEN for its engineering scope.

M1:

- implementation complete;
- merged to main;
- tested;
- release tooling complete;
- production closure still blocked only by owner-account actions;
- do not repeatedly investigate those access blockers.

M2 completed so far:

- redesigned TodayCard / ME hierarchy;
- enriched PartnerGlance;
- compact six meal-slot tiles;
- first-empty-slot FAB;
- significantly lower-friction logging;
- quick add;
- clear ownership;
- quiet/honest sync indication;
- mobile visual verification;
- all current tests green.

The previous run selected:

**M2-3 — quiet the secondary blocks: fold the fixed weigh-in banner and the workout/fasting cards into one compact row under the meal tiles.**

That is the primary scope of this run.

---

# OPERATING MODE

Work autonomously.

Do not stop because M1 production access is unavailable.

Do not repeat known Supabase/Lovable investigations.

Do not redesign backend architecture.

Do not add speculative features.

Use the current product in a phone viewport and improve the real experience.

The goal is not "more UI."

The goal is:
**less friction, less vertical space, clearer daily context.**

---

# PHASE 1 — FAST BASELINE

Quickly verify:

- current branch;
- HEAD;
- origin/main;
- clean/dirty worktree;
- current mobile home screen;
- screenshots or browser state from the previous run.

Capture a baseline at:

- Pixel 7-class viewport;
- approximately 360×740.

Measure the home screen vertical footprint before changes.

Do not spend substantial time documenting the baseline.

---

# PHASE 2 — SECONDARY DAILY STATUS ROW

The current remaining visual problem is that:

- weigh-in;
- workout;
- fasting

occupy too much vertical space and compete with the actual nutrition loop.

Redesign these into a compact secondary-status area.

Desired hierarchy:

1. ME / daily nutrition;
2. partner;
3. meal logging;
4. secondary body/routine context.

Weight, workout and fasting are context, not the primary product.

Implement one coherent compact treatment.

Possible direction:

a single horizontal/compact row containing small status cells such as:

- Weight
- Workout
- Fasting

But do not blindly follow this layout if the existing UI suggests a cleaner option.

Each item should:

- show the current state immediately;
- remain tappable if an existing action exists;
- not require opening another page just to understand the state;
- remain readable on narrow mobile screens.

Avoid large standalone cards.

Avoid decorative icons dominating the UI.

---

# PHASE 3 — WEIGH-IN EXPERIENCE

Inspect the existing weigh-in interaction.

The fixed banner currently consumes disproportionate space.

Improve it without redesigning the weight system.

The user should understand:

- today's weight, if logged;
- whether today's weight has not yet been entered;
- how to add/edit it quickly.

If no weight was logged today, provide a subtle action.

If already logged, show the value compactly.

Do not create guilt-inducing wording.

Do not add streaks, warnings, red states or nagging.

---

# PHASE 4 — FASTING STATUS

Use only existing reliable data.

Compactly represent whether:

- a fast is active;
- completed/recorded;
- absent.

If an active fasting session has meaningful timing information already available, present it cleanly.

Do not invent timers or new backend mechanics unless the current architecture already supports them.

Fasting should not dominate the screen.

---

# PHASE 5 — WORKOUT STATUS

Represent today's workout/activity state compactly.

Use existing data only.

Do not turn the nutrition application into a fitness tracker.

The user should simply be able to understand whether today's workout is recorded, and interact with the existing behavior if relevant.

---

# PHASE 6 — WHOLE HOME-SCREEN COMPOSITION

After implementing the compact secondary row, inspect the entire home screen again.

Do not evaluate components independently.

Look at the phone as a complete experience.

The desired visual order should feel roughly:

- identity/day;
- my daily state;
- partner daily state;
- six meal opportunities;
- compact secondary context;
- quick action.

Adjust spacing and hierarchy so the screen feels intentionally designed as one product.

Question every remaining large gap, border, card or duplicated label.

Remove unnecessary UI rather than merely shrinking it.

---

# PHASE 7 — FIRST-SCREEN VALUE

On a Pixel-7-sized screen, maximize what the user can understand before meaningful scrolling.

Ariel or Elena should ideally see most or all of:

- whose day is being viewed;
- daily progress/state;
- partner state;
- meal slots;
- next logging action;
- secondary daily context.

Do not compress text until readability suffers.

This is a balance problem, not a "fit everything at any cost" problem.

Report what is visible above the fold before vs after.

---

# PHASE 8 — EMPTY / PARTIAL / COMPLETE STATES

Inspect the redesigned home under several realistic states:

1. brand-new/empty day;
2. partially logged day;
3. mostly/full documented day;
4. partner with no entries;
5. partner with entries;
6. weight absent;
7. weight present;
8. workout/fasting absent/present.

The home must remain visually stable.

Avoid dramatic layout jumps depending on state.

Do not leave giant empty areas.

---

# PHASE 9 — QUICK-LOG LOOP POLISH

Do not rebuild MealEditor.

The previous run already substantially reduced logging friction.

Instead test the complete loop from:

Home
→ choose slot
→ quick add
→ confirmation
→ return to Home.

Check whether there is any remaining unnecessary interruption.

The successful loop should make the updated meal slot / last activity visibly understandable after the save.

If one very small change materially improves this loop, implement it.

Do not expand this into another logging redesign.

---

# PHASE 10 — PARTNER FEEDBACK

Test the couple experience conceptually and technically:

Ariel logs something.

Then Elena's view should clearly show that partner activity after the supported synchronization/hydration path.

The interface should make it feel like:

"my partner just logged something"

rather than:

"a database record changed."

Use human language.

Do not add social-feed complexity, reactions, comments or notifications.

Those are outside this milestone.

---

# PHASE 11 — RTL / TEXT QUALITY

The previous output/report contained signs of reversed Hebrew in terminal rendering.

Inspect the ACTUAL browser UI, not terminal output.

Verify:

- Hebrew renders correctly;
- RTL alignment is intentional;
- punctuation around numbers/times works;
- long food names truncate/wrap gracefully;
- English/numeric values do not break layout.

Do not alter strings merely because terminal output visually reversed them.

Browser behavior is the truth.

---

# PHASE 12 — ACCESSIBILITY / TOUCH

Perform a pragmatic mobile accessibility check.

Verify:

- important tap targets are sufficiently large;
- compacting the UI did not make controls difficult to tap;
- text remains legible;
- icon-only actions have accessible labels;
- status is not communicated only through colour.

Do not undertake a broad accessibility rewrite.

Fix obvious regressions within this scope.

---

# PHASE 13 — PERFORMANCE / RENDER SANITY

Because the home page now hydrates both people and multiple daily states, inspect for obvious unnecessary render/refetch loops.

Do not prematurely optimize.

But verify that:

- switching date;
- switching person;
- quick logging;
- partner hydration

do not trigger pathological repeated requests or visible flicker.

If there is a clear bug, fix it.

Do not redesign state management.

---

# M1 RULE

M1 remains YELLOW until owner production actions occur.

Do not claim otherwise.

Do not repeatedly test inaccessible accounts.

Keep:

`docs/claude-tasks/M1_RELEASE_ACCEPTANCE.md`

as the canonical release-close procedure.

If nothing changed regarding M1, simply say so in the final report.

Do not produce another long M1 analysis.

---

# LOCAL PHONE DATA

No automatic migration.

No deletion.

No cloud import.

M1-R5 remains pending Ariel's decision.

Do not spend meaningful run time on this topic.

---

# VISUAL VERIFICATION

Required.

Inspect at least:

- 412×915;
- 360×740.

Capture before/after evidence using the project's existing visual-testing workflow where practical.

Check the full page, not only isolated components.

Specifically report:

- approximate home height;
- what is visible before scrolling;
- whether secondary status remains understandable;
- any remaining obvious visual debt.

---

# TESTING

Run appropriate:

- `tsc`;
- lint;
- unit tests;
- relevant integration tests;
- hermetic browser tests;
- production build.

Add/update tests for the secondary status row and important interaction behavior.

Keep tests deterministic.

Do not weaken existing tests simply to get green.

---

# GIT

Use coherent commits.

Before push:

- inspect diff;
- remove debug artifacts;
- check for accidental secrets;
- verify documentation changes;
- ensure build remains green.

Push completed green work to main according to the existing project workflow.

No force-push.

---

# DOCUMENTATION

Continue existing canonical repo documentation.

Update:

- run record;
- prompt archive;
- project status;
- todo;
- decisions only if an actual durable decision was made;
- last-run timestamp.

Do not create unnecessary new documents.

---

# IF TIME REMAINS

Only after M2-3 is polished, tested and documented:

perform a short M2-4 discovery.

Do NOT automatically implement it.

Identify the single highest-friction remaining part of the normal daily usage loop.

Candidates may include:

- food search quality;
- recent/favourite discovery;
- editing logged items;
- day navigation;
- partner visibility;
- repeated meals.

Base the recommendation on observed product behavior.

Do not pick based on theoretical feature value.

Document ONE next milestone.

---

# SUCCESS CRITERIA

This run succeeds when:

1. the weigh-in banner is no longer a large standalone interruption;
2. workout + fasting no longer dominate vertical space;
3. secondary daily context is compact but still understandable;
4. the full home screen feels materially calmer;
5. the quick-log loop still works cleanly;
6. partner state remains visible and useful;
7. no ownership/sync regressions are introduced;
8. narrow mobile screens remain usable;
9. tests/build remain green;
10. completed work is pushed.

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

## HOME BEFORE

Short description plus approximate vertical footprint.

## M2-3 IMPLEMENTED

Exactly what changed.

## SECONDARY STATUS

Weight / fasting / workout behavior.

## HOME AFTER

What a user sees on first screen and approximate vertical footprint.

## DAILY LOOP

What changed, if anything, in the full logging loop.

## PARTNER EXPERIENCE

Any improvement/regression.

## RTL / MOBILE

412×915 and 360×740 findings.

## ACCESSIBILITY

Relevant findings/fixes only.

## PERFORMANCE

Only observed findings.

## M1

One concise paragraph unless its state materially changed.

## TESTS

Exact results.

## GIT

Ending SHA(s) and push state.

## DOCUMENTATION

Exact files.

## YOU

Only actions Ariel truly must perform himself.

Keep the known M1 owner actions concise; do not expand them into another engineering report.

## NEXT

Select ONE M2-4 milestone based on observed friction.

## RUN TIMESTAMP

Exact local date/time and update the canonical last-run record.

Do not stop early because production M1 remains owner-blocked.
