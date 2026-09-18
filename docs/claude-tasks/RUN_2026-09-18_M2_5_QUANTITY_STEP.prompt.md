# Task prompt — run of 2026-09-18 (sixth run, M2-5) — verbatim as received; list markers may be normalized by prettier

Continue the Nutrition App directly from the current repository state.

Expected starting point:

`main @ 1d25473`

Verify actual branch / HEAD / origin / worktree first.

Do NOT restart takeover.
Do NOT repeat M1 investigation.
Do NOT revisit stable architecture unless current evidence contradicts it.

Read the latest:

- project status;
- TODO;
- decisions;
- M2-4 run record;
- current MealEditor / quick-add implementation.

Then execute.

# CURRENT PRODUCT STATE

M2 currently has:

- compact home;
- TodayCard;
- PartnerGlance;
- six meal-slot tiles;
- fast quick-add flow;
- clear person ownership;
- quiet sync status;
- compact weight/workout/fasting context row;
- Day Review for both partners;
- read-only partner review;
- editing shortcuts;
- mobile/RTL verification;
- green test/build state.

The current observed friction is:

A quick-added food defaults correctly to one usual unit, but common foods often need an immediate small correction:

- 2 eggs;
- 2 slices;
- 2 units;
- 3 pieces;
- etc.

Today, correcting that quantity requires opening the quantity editor and confirming.

M2-5 should make this correction immediate.

# PRIMARY MILESTONE

Implement:

# M2-5 — ONE-TAP QUANTITY ADJUSTMENT

Goal:

After quick-adding a food, the user should be able to change the common quantity with minimal effort without leaving the normal logging flow.

The best outcome is:

quick add
→ entry appears
→ − / quantity / +
→ continue

No extra modal for simple quantity corrections.

Preserve the full quantity editor for advanced cases.

---

# PHASE 1 — BASELINE

Quickly inspect:

- current FoodEntry quantity representation;
- supported quantity/unit types;
- MealEditor row structure;
- quick-add behavior;
- current toast behavior;
- quantity edit modal/screen;
- any existing quantity increment/decrement helpers;
- persistence/save semantics.

Do not redesign quantity architecture.

Determine the actual common quantity model before changing controls.

---

# PHASE 2 — INLINE STEPPER IN MEAL EDITOR

For existing logged food rows in MealEditor, add a compact inline quantity adjustment when it is safe and meaningful.

Conceptually:

`−   2 יחידות   +`

but follow existing UI language and layout.

Requirements:

- compact;
- touch-friendly;
- clearly associated with the correct food;
- works in RTL;
- does not dominate the row;
- immediately reflects the resulting quantity;
- uses existing persistence path;
- retains full edit path for non-simple quantities.

Do not add a large form into every row.

---

# PHASE 3 — STEP RULES

Do NOT assume every food uses integer increments.

Inspect the existing quantity/unit model.

Define safe step behavior based on actual data.

Examples:

- unit/piece/egg/slice-like quantities may reasonably step by 1;
- grams/ml may require a different existing step;
- fractional quantities may already exist;
- coffee may have special behavior;
- custom free-text or unsupported quantities should fall back to the existing editor.

Do not invent unit semantics.

If a reliable generic step already exists, reuse it.

If not, define the smallest deterministic mapping supported by current data.

Document the decision if durable.

---

# PHASE 4 — LOWER BOUND / DELETE BEHAVIOR

Be conservative around decrementing.

Do not allow invalid quantities.

Decide explicitly what happens at the minimum.

Preferred behavior:

- decrement stops at the smallest valid quantity;
- deleting an item remains a separate deliberate action.

Do NOT make `1 → 0` silently delete food unless the product already has that rule.

Avoid accidental data loss.

---

# PHASE 5 — QUICK-ADD FEEDBACK

The previous quick-add flow uses a transient confirmation/toast.

Improve the immediate post-add experience so quantity can be corrected without hunting for the row.

Evaluate the cleanest option:

- inline stepper immediately visible on the newly added row;
- small action in the toast;
- brief highlight/scroll-to-new-entry;
- another lightweight mechanism.

Do NOT build a second quantity editor inside the toast if it becomes visually awkward.

Prioritize discoverability of the newly added row.

The user should understand:

"I added 1 egg. I need 2. Tap + once."

---

# PHASE 6 — SAVE SEMANTICS

Quantity changes must use the existing data model and sync/persistence path.

Verify:

- correct person;
- correct date;
- correct slot;
- correct entry;
- cloud queue semantics;
- local state update;
- sync status.

Avoid creating one network write per rapid tap if the current architecture makes that problematic.

Inspect current save behavior.

If rapid `+++` would cause multiple unnecessary writes or race conditions, implement a small safe debounce/coalescing strategy only if needed.

Do not introduce complexity without evidence.

The UI must remain responsive.

---

# PHASE 7 — OPTIMISTIC UI / ERROR SAFETY

A quantity tap should feel immediate.

Use existing optimistic-state conventions if present.

Do not falsely show durable success if saving fails.

If persistence fails:

- preserve honest sync/error state;
- do not silently revert without explanation;
- do not lose the entry.

Stay consistent with the app's existing durable queue model.

---

# PHASE 8 — ACCESSIBILITY / TOUCH

Required:

- − / + controls have meaningful accessible names including the food name where practical;
- minimum 40–44px practical touch targets;
- quantity itself is readable;
- disabled decrement state is understandable;
- not dependent on colour.

Check screen reader order in RTL.

---

# PHASE 9 — MOBILE / RTL

Visually verify:

- 412×915;
- 360×740.

Test rows with:

- short food name;
- long food name;
- integer quantity;
- fractional quantity if supported;
- unit label;
- multiple entries in the same meal.

No horizontal overflow.

Do not make food names unreadable just to fit controls.

If necessary, use a two-line row structure rather than cramming everything horizontally.

---

# PHASE 10 — DAY REVIEW

Day Review is primarily read-only.

Do NOT automatically put steppers into Day Review.

Its job is review, not editing.

Preserve:

- pencil → existing MealEditor for own slot;
- partner review read-only.

If the inline stepper is useful once MealEditor opens, that is enough.

Do not duplicate controls across surfaces.

---

# PHASE 11 — QUICK-ADD TAP COUNT

Measure the common case before and after.

Examples:

## Two eggs

Before:
tile
→ quick add egg
→ pencil/edit quantity
→ quantity screen
→ change
→ confirm

After:
tile
→ quick add egg
→ `+`

Report actual interaction counts observed.

Do not inflate the metric.

---

# PHASE 12 — EDGE CASES

Test at minimum:

1. quantity = 1;
2. increment to 2;
3. repeated increments;
4. decrement;
5. minimum boundary;
6. fractional quantity;
7. gram/ml-style quantity if supported;
8. long food name;
9. coffee/special item;
10. rapid taps;
11. offline/pending save;
12. reload after persisted quantity change.

Do not force inline stepping on quantity types where it is unsafe.

Fallback to existing editor is acceptable.

---

# PHASE 13 — PERFORMANCE

Inspect whether rapid quantity taps cause:

- excessive renders;
- duplicate queue records;
- duplicate Supabase writes;
- race conditions;
- visible flicker.

Fix only demonstrated issues.

Do not redesign state management.

---

# PHASE 14 — TESTS

Add focused deterministic coverage.

At minimum:

- - increments correct entry;
- − decrements correct entry;
- cannot go below valid minimum;
- active person/date/slot preserved;
- partner data unaffected;
- multiple entries don't update the wrong row;
- reload persists final quantity;
- unsupported quantity type falls back correctly;
- rapid taps produce correct final state;
- accessibility labels.

Browser-test one realistic quick-add → increment → finish → Day Review path.

Do not weaken existing tests.

---

# PHASE 15 — VISUAL PRODUCT CHECK

After implementation, inspect the complete MealEditor.

Make sure it has not become cluttered.

The primary action remains:

adding food.

Quantity stepping is secondary.

If every row suddenly looks like an accounting table, simplify it.

The target feeling is:

"easy correction"

not:

"quantity management system."

---

# M1

M1 remains YELLOW unless owner production actions actually occurred.

Do not reinvestigate owner access.

Do not modify the release procedure.

Mention M1 briefly in the final report only.

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

- nutrition calculations;
- calories/protein;
- AI;
- barcode scanning;
- social interactions;
- notifications;
- realtime;
- new backend tables;
- new quantity architecture;
- bulk editing.

This milestone is one small but high-frequency friction reduction.

---

# GIT

Use coherent commits.

Before push:

- inspect diff;
- remove debug output;
- verify no credentials;
- run relevant tests;
- production build green.

Push completed green work to main under the existing project workflow.

No force-push.

---

# DOCUMENTATION

Continue the existing repo-native system.

Save:

- prompt;
- run report;
- durable decision if needed;
- project status;
- TODO;
- canonical last-run timestamp.

Avoid redundant docs.

---

# IF M2-5 FINISHES EARLY

Do not automatically start coding M2-6.

Perform a short evidence-based friction scan.

Observe the daily loop:

Home
→ choose slot
→ find food
→ quick add
→ adjust quantity
→ finish
→ review day.

Identify ONE remaining highest-friction step.

My default hypothesis is likely:

**food discovery / recent / favourites**

but do not accept that hypothesis automatically.

Measure actual interaction cost.

Select one M2-6 milestone and report it.

Do not implement a broad new feature unless it is a tiny continuation of M2-5.

---

# SUCCESS CRITERIA

This run succeeds when:

1. simple quantity corrections no longer require a separate quantity screen;
2. - / − behavior is deterministic and safe;
3. advanced quantities still have the existing edit path;
4. quantity changes affect the correct entry/person/date/slot;
5. rapid taps do not create consistency problems;
6. MealEditor remains visually calm;
7. mobile/RTL stays clean;
8. the quick-add common case becomes materially faster;
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

Actual quantity correction flow before M2-5.

## M2-5 IMPLEMENTED

Exactly what changed.

## STEPPER RULES

Which quantity/unit types support inline stepping and why.

## QUICK-ADD FLOW

Before/after tap count for 2–3 representative examples.

## SAVE / SYNC

How quantity changes persist and how rapid taps behave.

## EDGE CASES

Relevant findings.

## MOBILE / RTL

412×915 and 360×740 findings.

## ACCESSIBILITY

Only meaningful findings/fixes.

## PERFORMANCE

Observed write/render behavior.

## DAY REVIEW

Confirm no unnecessary editing controls were added there.

## M1

Concise unchanged/changed status.

## TESTS

Exact results.

## GIT

Ending SHA(s), branch and push status.

## DOCUMENTATION

Exact files.

## YOU

Only owner actions genuinely required.

## NEXT

ONE evidence-based M2-6 milestone.

## RUN TIMESTAMP

Exact local date/time and update canonical last-run timestamp.

Work autonomously.
Do not stop because production M1 remains owner-blocked.
