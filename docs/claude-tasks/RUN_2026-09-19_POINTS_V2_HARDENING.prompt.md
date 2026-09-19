# Task prompt — run of 2026-09-19 (twelfth run, points v2-il + hardening, 2-hour window) — verbatim as received; list markers may be normalized by prettier

You have approximately 2 hours for one focused autonomous hardening + points-model refinement run on the Nutrition App.

This is ONE run.
Do not split it into multiple future tasks unless something is genuinely blocked.

Expected starting point:
main @ f99254e

FIRST:

- verify branch = main
- verify HEAD
- verify origin/main
- verify clean worktree
- read canonical project/OS instructions
- inspect latest production migrations and current documentation

==================================================
CONTEXT
==================================================

The app is a private shared nutrition tracker for Ariel and Elena.

Recent real-device feedback was already implemented:

1. silent anonymous Supabase access;
2. one shared household;
3. mobile/RTL hardening;
4. calmer colors / stronger tile borders;
5. simplified bottom navigation;
6. daily steps;
7. quantity reporting restored;
8. internal points v1 added;
9. keyboard pre-positioning added.

Current production Supabase includes:

- anonymous device join
- hardening migration
- daily_steps migration
- internal_points_v1 migration 20260919082000

Do NOT re-run old migrations.
Never plain `supabase db push`.

The purpose of this run is:

- review Lovable's implementation deeply;
- harden keyboard / quantity / points / sync;
- refine the points model to be substantially closer in spirit to the historical Weight Watchers / Israeli "שומרי משקל" model that Elena knows;
- preserve existing production data safely.

==================================================
PRODUCT DIRECTION — WEIGHT WATCHERS INSPIRED
==================================================

IMPORTANT:

We are NOT attempting to copy or claim the proprietary WeightWatchers formula.

We want an internal, transparent, versioned model that behaves similarly enough that a former Weight Watchers professional would find its logic familiar.

Public WeightWatchers principles to emulate:

- food gets a simple points value;
- nutritionally preferable foods generally cost fewer points;
- saturated fat / added sugar tend to raise points;
- protein / fiber / unsaturated fat tend to reduce points;
- daily allowance is personalized;
- allowance changes with the person's body and age;
- no food should be morally labelled "good" or "bad";
- the system should be simple enough to track daily.

PRODUCT OVERRIDE:

We intentionally do NOT copy the current global WW ZeroPoint rule for fruit.

For THIS app:

- vegetables = 0 points;
- fruit = positive points;
- this is deliberate and closer to the older Israeli model Ariel/Elena know.

Treat Elena's familiarity with the historical system as a future calibration source.

Do NOT ask her to disclose confidential/proprietary formulas.
We only need experiential calibration such as:
"this used to feel like roughly 1 / 1.5 / 3 points."

==================================================
A. BASELINE GATE
==================================================

Before modifying anything run the meaningful full baseline:

- bun install --frozen-lockfile if needed
- typecheck
- lint
- full Vitest
- hermetic Playwright
- production build
- preflight --env
- relevant PGlite/database tests

Record exact counts.

If anything is already broken:
fix root cause before adding model changes.

==================================================
B. POINTS MODEL VERSIONING
==================================================

Do NOT mutate already-persisted v1 points snapshots silently.

Introduce the refined model as a new explicit version, e.g.:

`points_model_version = "v2-il"`

or another clear version name.

Existing v1 entries:

- retain their saved points_value;
- retain points_model_version='v1';
- must never be recalculated in place automatically.

Newly created / deliberately edited entries after this release:

- use the new model;
- save a new points snapshot;
- save the new model version.

Display logic:
persisted snapshot always wins.

No production backfill.

==================================================
C. FOOD POINT PHILOSOPHY
==================================================

Move the implementation closer to Weight Watchers principles WITHOUT inventing fake nutritional precision.

Preferred calculation hierarchy:

1. explicit food-level calibrated point value / standard portion, if such a value exists;
2. nutrition-based calculation if real nutrient data exists;
3. category-based fallback if neither exists.

Do NOT pretend category-only scoring is the exact WW formula.

Keep the architecture capable of improving later.

==================================================
D. VEGETABLES
==================================================

Vegetables are always zero points in this product.

At minimum:

- ירקות ועשבי תיבול = 0.

If catalog taxonomy contains obvious vegetable subcategories:
treat them consistently.

Quantity must not change this:
100 g vegetable = 0
500 g vegetable = 0
"יותר מדי" vegetable = 0

Do not charge points merely because the user reported a large vegetable quantity.

Tests required.

==================================================
E. FRUIT
==================================================

Fruit must NOT be zero.

Use a deliberately low positive baseline.

Initial fallback rule:

`fruit base = 1 point per standard portion`

Examples:

- 1 typical unit → ~1 point
- 150 g → approximately 1.5 points with the existing measured scaling
- subjective:
  מעט → lower
  במידה → baseline
  יותר מדי → higher
  מוגזם → higher again

Do not classify fruit as free food.

If a specific fruit later receives an explicit calibrated value, that explicit value should override the generic fruit fallback.

Tests:

- fruit > 0
- fruit scales with grams
- fruit scales with units
- fruit scales with subjective mode
- vegetables remain 0

==================================================
F. SUBJECTIVE QUANTITY
==================================================

The restored subjective mode is a core product feature.

Visible labels must remain:

- מעט
- במידה
- יותר מדי
- מוגזם

Historical internal value `"הרבה"` may remain for compatibility, but user-visible wording = "יותר מדי".

Recommended v2 portion multipliers:

מעט = 0.5
במידה = 1.0
יותר מדי = 1.5
מוגזם = 2.0

Keep these centralized in one model function/config.

==================================================
G. MEASURED QUANTITY / UNITS
==================================================

Review the current measured scaling critically.

The user must be able to:

- enter an amount;
- choose a suggested unit;
- open all valid units;
- change unit before saving.

Do not allow absurd silent calculations such as:
"1 gram = one full portion."

Review:

- grams
- kg
- ml
- liter
- unit
- half unit
- tablespoon
- teaspoon
- cup
- mug
- slice
- bowl
- serving

The model must clearly distinguish:
weight/volume scaling
vs
count/serving scaling.

Centralize standard-portion assumptions.

Do not scatter conversion constants across UI.

==================================================
H. NUTRITION-AWARE ARCHITECTURE
==================================================

Current public WW-style systems consider nutritional properties such as:

- calories;
- saturated fat;
- added sugar;
- protein;
- fiber;
- unsaturated fat.

Our current catalog may not contain all these fields.

Do NOT fabricate them.

But make the v2 architecture ready for them.

Preferred optional model:

NutritionFacts:

- calories
- proteinG
- fiberG
- saturatedFatG
- addedSugarG
- unsaturatedFatG
- servingAmount
- servingUnit

If these real values are present in the future:
the points engine should be able to route through a nutrient-based calculation.

For now:
category fallback remains valid where nutrition facts are absent.

Do not populate invented nutrition data in production.

==================================================
I. CATEGORY FALLBACK — WW-LIKE RELATIVE ORDER
==================================================

Audit all real catalog categories.

The fallback ordering should approximately follow this philosophy:

LOW:

- vegetables = 0
- fruit = low positive
- lean protein / fish / legumes = relatively low

MEDIUM:

- dairy
- eggs
- grains / carbohydrates
- breads

HIGHER:

- spreads / nuts / fats
- prepared dishes depending on category

HIGHEST:

- sweets / snacks
- sugary drinks
- rich sauces / oils

Do not moralize the labels in the UI.

This is only a scoring hierarchy.

Ensure every actual category in the real catalog maps deterministically.

No accidental unknown categories.

==================================================
J. DAILY POINTS TARGET — PERSONALIZED
==================================================

A fixed daily target of 30 is no longer the normal product behavior.

The default target must be personalized.

At minimum it must depend on:

- sex assigned at birth;
- age;
- current weight.

To remain closer to the Weight Watchers approach, ALSO support:

- height;
- goal mode: weight loss / maintenance

Do not infer these from names.

Preferred profile data:

- sex_at_birth: male | female
- birth_date
- height_cm
- goal_mode: lose | maintain
- optional points_budget_override

Weight source:
use the latest valid weigh-in for that profile.

Do NOT create a second conflicting "current weight" truth unless necessary.

==================================================
K. PERSONALIZED BUDGET — METABOLIC APPROACH
==================================================

Weight Watchers publicly describes its budget as metabolic-rate based and considers age, height, weight and sex.

Therefore the internal approximation should use a metabolism-derived model, not an arbitrary:
"male +3 / age -1"
style score.

Use Mifflin-St Jeor as the transparent metabolic basis:

male:
BMR = 10*weightKg + 6.25*heightCm - 5\*age + 5

female:
BMR = 10*weightKg + 6.25*heightCm - 5\*age - 161

Do NOT claim this reproduces Weight Watchers' proprietary daily-budget equation.

Use it only as the personalization backbone.

For v2-il, create ONE pure function such as:

calculatePersonalizedPointsBudget({
sexAtBirth,
age,
heightCm,
weightKg,
goalMode
})

All constants must live in one versioned configuration file.

==================================================
L. BUDGET SCALE — PROVISIONAL CALIBRATION
==================================================

Use a transparent provisional mapping, easy to tune later.

Recommended starting calibration for weight-loss mode:

REFERENCE_BMR = 1400
REFERENCE_DAILY_POINTS = 23

rawBudget =
REFERENCE_DAILY_POINTS \* (BMR / REFERENCE_BMR)

For maintenance mode:
apply a documented configurable uplift, not a hidden magic number.

Round to nearest 0.5 or whole point consistently.

Clamp the weight-loss budget to a safe product range:

minimum 14
maximum 45

IMPORTANT:

These are INTERNAL behavioral scoring parameters, not a prescription for calorie intake and not a claim to be the Weight Watchers calculation.

Put these constants in ONE place.

Elena's future real-world calibration should be able to change them without rewriting the app.

==================================================
M. MISSING PROFILE DATA
==================================================

Do not block logging.

If the profile lacks:

- sex
- birth date
- height
- latest weight

then:

- app still works;
- use a temporary fallback budget;
- show a quiet prompt:
  `השלמת פרטים להתאמת יעד הנקודות`

Do not nag repeatedly.

Once sufficient data exists:
switch automatically to personalized target.

Do not silently treat the old 30 as a user-chosen target.

==================================================
N. MANUAL OVERRIDE
==================================================

Support an explicit manual override.

Preferred semantics:

`points_budget_override: nullable`

If null:
use personalized calculated budget.

If set:
manual target wins.

UI must indicate subtly:
`יעד מותאם אישית`

and offer:
`חזרה ליעד אוטומטי`

Do not reuse one DB column ambiguously for both automatic and manual values.

==================================================
O. PROFILE ISOLATION
==================================================

Critical:

Ariel:

- sex
- age
- height
- weight
- budget
- override

must not affect Elena.

Elena's values must not affect Ariel.

Prove via tests.

Realtime updates must update only the correct profile.

==================================================
P. AGE
==================================================

Store birth date, not a permanently stored "age integer", unless architecture requires otherwise.

Calculate age from date.

Target should therefore evolve automatically over time without DB rewrites.

Tests around birthday boundary.

==================================================
Q. WEIGHT
==================================================

Use latest valid weigh-in.

New weigh-in:
→ personalized budget recalculates.

Deleting/altering a latest weigh-in:
→ target recalculates correctly.

This must NOT change historical food-entry points snapshots.

==================================================
R. FOOD SNAPSHOT INTEGRITY
==================================================

Critical.

Prove for:

- new entry
- measured amount edit
- unit change
- measured → subjective
- subjective → measured
- subjective level edit
- +/− quantity stepper
- offline write
- queue replay
- Realtime roundtrip

that:

final persisted:

- points_value
- points_model_version

match the final entry state.

No stale v1/v2 mixture.

==================================================
S. OLD DATA
==================================================

Old entries without points snapshot:

- calculate fallback for display only if required;
- do not automatically rewrite them.

Existing v1 entries:

- display their v1 snapshot;
- do not reinterpret under v2.

If edited:
explicitly migrate only THAT entry to v2 semantics and store the new v2 snapshot.

Document this.

==================================================
T. QUANTITY UX
==================================================

Typed search result:
ALWAYS opens quantity choice.

The quantity screen must expose:

tab 1:
`מדידה`

tab 2:
`לפי תחושה`

Measured:

- amount
- unit selection
- "יחידות נוספות"

Subjective:

- מעט
- במידה
- יותר מדי
- מוגזם

Points preview must update instantly when:

- amount changes
- unit changes
- mode changes
- subjective level changes

Editing existing entry:
restore exact saved mode/value/unit.

Switching between modes before save must not leak stale fields.

==================================================
U. QUICK ADD
==================================================

Preserve low-friction quick add.

Favourite/recent chip may remain one-tap ONLY when the usual quantity is trustworthy.

After quick add:

- snapshot must be v2
- point value correct
- +/- must recalculate points
- pencil must open full quantity editor

Never quick-add:
1 gram
1 ml
or another meaningless default.

==================================================
V. KEYBOARD — REAL-DEVICE FEEDBACK
==================================================

The user explicitly complained that the keyboard opened and THEN the UI visibly corrected itself.

Desired behavior:

tap input
→ input already positioned
→ keyboard appears
→ no visible jump

Audit current:
`use-keyboard-safe-viewport.ts`

Check for:

- pointerdown centering that itself produces visible motion;
- focusin correction;
- VisualViewport resize correction;
- duplicate corrections;
- Android Chrome behavior;
- iOS Safari behavior;
- bottom-sheet translate animations;
- fixed footer movement.

Test at least:

- food search
- quantity amount
- points profile setup
- manual points override
- steps
- weigh-in
- custom food
- any other numeric field

Viewports:
360×740
412×915

No smooth scroll.

No delayed timer-based recenter.

Only instant nearest-edge correction if genuinely obscured.

Clearly state:
browser emulation != physical keyboard proof.

==================================================
W. DAILY POINTS UI
==================================================

Keep Home calm.

Today card should show simply:

`נקודות 14 / 27`
`נשארו 13`

or

`חריגה 2`

No calorie display.

No big dashboard.

No judgmental:
רע
נכשלת
אסור
חרגת יותר מדי

Points are information, not punishment.

==================================================
X. PARTNER EXPERIENCE
==================================================

Because this is a couple app:

Partner glance should make it possible to understand the partner's point state without clutter.

Do NOT expose private profile-setup fields unnecessarily.

Showing:

- points consumed
- budget
- remaining

is acceptable.

Do not make partner view editable accidentally.

==================================================
Y. FUTURE WEEKLY POINTS
==================================================

Weight Watchers-like systems often have weekly flexibility.

Do NOT implement a weekly bank during this two-hour run unless all P0/P1 work is fully complete and the architecture makes it trivial.

But ensure today's schema/model does not make future:

- weekly allowance
- rollover
- activity bonus

impossible.

Document as future capability only.

==================================================
Z. ELENA CALIBRATION
==================================================

Because Elena worked in Weight Watchers, prepare a small calibration checklist for later.

Do NOT ask for proprietary formula details.

Prepare examples such as:

- apple
- banana
- bread slice
- egg
- chicken breast
- rice serving
- chocolate
- olive oil
- yogurt
- hummus

For each show:
our current v2-il estimate.

The future question to Elena is simply:

`האם זה מרגיש נמוך / נכון / גבוה ביחס לשיטה שהכרת?`

This gives us expert calibration without copying confidential methodology.

Do NOT block this run waiting for her.

==================================================
AA. OFFLINE / REALTIME
==================================================

Device A = Ariel
Device B = Elena

Prove:

A logs food
→ A points total updates
→ B partner view updates

A edits quantity offline
→ reconnect
→ final quantity + points converge

B updates profile information
→ only B budget recalculates

A receives B's updated partner budget by Realtime if intended.

No duplicate subscriptions.

No stale snapshot replay.

==================================================
AB. DATABASE MIGRATION
==================================================

If profile schema changes are needed:
create a NEW forward-only migration.

Likely fields:

profiles:

- sex_at_birth
- birth_date
- height_cm
- goal_mode
- points_budget_override

Do not edit 20260919082000.

Preserve:

- RLS
- grants
- household isolation
- realtime

No guessed backfill for:
sex
birth date
height

Existing profiles remain valid with null fields.

Never plain `supabase db push`.

Create:

- reviewed migration
- reviewed apply script
- read-only verify script

Do NOT apply production schema automatically unless project policy and tools explicitly permit and all tests are green.

If applied:
verify ledger and schema.

==================================================
AC. SECURITY
==================================================

Do not "fix" expected anonymous-auth advisor warnings by breaking DEC-031.

Anonymous Supabase sessions intentionally become authenticated-role members after bootstrap.

Ensure:

- no service_role in browser
- RLS remains
- new profile fields protected
- no public unrestricted writes

==================================================
AD. ACCESSIBILITY / RTL
==================================================

Run axe where applicable.

Check:

- quantity tabs
- subjective buttons
- units
- points preview
- profile setup
- budget override
- focus
- dialogs
- RTL numeric rendering
- screen reader labels

==================================================
AE. PERFORMANCE
==================================================

Do not introduce:

- catalog scans repeatedly per render
- repeated recalculation loops
- duplicate profile reads
- extra Realtime subscriptions
- write amplification

Point calculations should be pure and cheap.

Memoize only where evidence supports it.

==================================================
AF. FIX POLICY
==================================================

P0:

- wrong user's points
- wrong persisted snapshot
- data loss
- broken offline replay
- broken auth/realtime
- broken migration

P1:

- quantity feature regression
- keyboard unusability
- budget not updating correctly
- model calculation defect
- mobile clipping
- accessibility blocker

P2:
polish only after P0/P1 are exhausted.

==================================================
AG. TESTS REQUIRED
==================================================

At minimum add/verify tests for:

- vegetables = 0 at every quantity
- fruit > 0
- fruit gram scaling
- fruit subjective scaling
- category fallback completeness
- measured unit conversions
- subjective multipliers
- persisted v1 snapshot remains unchanged
- new v2 snapshot
- edited v1 entry intentionally becomes v2
- latest weight affects budget
- age affects budget
- sex affects budget
- height affects budget
- loss/maintenance behavior
- min clamp
- max clamp
- birthday age recalculation
- missing profile data fallback
- manual override
- clear override
- Ariel/Elena isolation
- Realtime profile change
- offline queue + points
- quantity mode roundtrip
- keyboard no post-open smooth/recenter behavior

==================================================
AH. GIT
==================================================

Use small coherent commits.

Before push:

- inspect diff
- remove debug logs
- scan secrets
- run relevant gates

Safe/reversible fixes may go directly to main under current project policy.

No force push.

==================================================
AI. PUBLISH POLICY
==================================================

If application code changes:
leave main green and publish-ready.

State clearly whether Lovable must publish.

If you have a safe, already-authorized publish path and all gates are green, publish.

Docs-only change:
do not publish.

==================================================
AJ. DOCUMENTATION
==================================================

Update canonical docs only.

Supersede/refine DEC-033 with a new points model decision.

Document:

- model is WW / Israeli Weight Watchers inspired, not proprietary WW;
- vegetables = zero;
- fruit = positive;
- v1 → v2 versioning;
- daily target derives from metabolism;
- age / height / weight / sex / goal;
- Mifflin-St Jeor basis;
- fallback behavior;
- manual override;
- snapshot immutability;
- Elena calibration plan;
- exact migration state;
- exact tests;
- exact final SHA;
- exact Israel local timestamp.

==================================================
REQUIRED FINAL REPORT
==================================================

## STATUS

Separate:

- repo
- keyboard
- quantity
- points v2-il
- personalized budget
- Supabase
- production
- real-device acceptance

## STARTING STATE

## FINDINGS

## FIXES

## POINTS MODEL

Explain:

- what makes it WW-like;
- what intentionally differs;
- why fruit is not zero;
- why vegetables are zero;
- what remains category fallback vs nutrition-aware.

## PERSONALIZED DAILY TARGET

Show formula and configuration constants clearly.

Do NOT claim it is the official Weight Watchers formula.

## SNAPSHOT VERSIONING

v1 vs v2 behavior.

## QUANTITY FLOW

## KEYBOARD

Automated proof vs physical-device proof.

## PROFILE / BUDGET ISOLATION

## OFFLINE / REALTIME

## DATABASE / MIGRATION

## SECURITY / RLS

## ACCESSIBILITY / RTL

## PERFORMANCE

## TESTS

Exact commands and exact pass/skip counts.

## GIT

Starting SHA → ending SHA(s)
origin/main
worktree

## DOCUMENTATION

## ELENA CALIBRATION TABLE

Small practical table of example foods with our current estimate.

## YOU

Only actions Ariel genuinely still needs.

Prefer:
"test these 3 things on phone"
rather than technical setup.

## NEXT

No new feature sprint.
Next = Ariel/Elena real-use calibration unless a blocker remains.

## RUN TIMESTAMP

Work autonomously for up to two hours.

Do not stop at the first green suite.
Do not expand scope beyond this prompt.
