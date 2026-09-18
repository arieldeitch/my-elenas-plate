# Task prompt — run of 2026-09-18 (fifth run, M2-4) — verbatim as received; list markers may be normalized by prettier

Continue the Nutrition App directly from the current repository state.

Expected starting point:

`main @ 1a94901`

Verify actual branch / HEAD / origin / worktree first.

Do NOT restart takeover.
Do NOT repeat M1 investigation.
Do NOT revisit architecture already resolved unless current evidence contradicts it.

Read the latest canonical project status, TODO, decisions and the M2-3 run record, then execute.

# CURRENT PRODUCT STATE

M2 now has:

- compact TodayCard;
- useful PartnerGlance;
- six compact meal-slot tiles;
- fast one-screen MealEditor;
- quick add;
- explicit ownership;
- quiet sync state;
- DailyContextRow for weight / workout / fasting;
- compact mobile home screen;
- Pixel 7 primary experience largely above the fold;
- tests/build green.

M1 remains YELLOW only because owner production actions are pending.

Do not spend this run trying inaccessible owner accounts again.

# PRIMARY MILESTONE

Implement:

# M2-4 — DAY REVIEW

Current observed friction:

The home page shows:

- total documented state;
- meal-slot statuses;
- latest activity;

but the user cannot answer:

**"What exactly did I eat today?"**

without opening meal slots individually.

Likewise, seeing the partner's actual day requires too much navigation.

Create a fast, calm daily review experience for both people.

The objective is NOT analytics.

The objective is:

**one place to see the day's actual logged food, grouped naturally, and reach editing quickly.**

---

# PRODUCT QUESTIONS THE FEATURE MUST ANSWER

For the currently selected date:

1. What did I eat?
2. In which meal/slot?
3. Roughly when was it logged?
4. Which slots were skipped?
5. What did my partner eat?
6. Can I quickly fix one of my own entries if something is wrong?

This should be answerable in seconds.

---

# PHASE 1 — BASELINE

Quickly inspect the current experience.

Determine:

- what tapping the TodayCard count currently does;
- what tapping meal-slot status currently does;
- existing History/calendar behavior;
- how MealEditor loads an existing slot;
- what data is already hydrated for me and partner;
- whether a daily summary can be rendered from existing state without new backend queries.

Prefer reuse of existing hydrated state.

Do not add another read path unless needed.

---

# PHASE 2 — DAY REVIEW ENTRY POINT

Provide a clear but unobtrusive path from the home screen.

Preferred candidates:

- tapping the TodayCard documented/count area;
- tapping an appropriate summary affordance.

Do not add another large home-screen card.

Avoid introducing another permanent primary button.

The home should remain as compact as M2-3.

If tapping the TodayCard is appropriate and accessible, prefer it.

Make the interaction discoverable enough without cluttering the screen.

---

# PHASE 3 — REVIEW SURFACE

Build a dedicated review surface appropriate for mobile.

Choose the best existing pattern:

- bottom sheet;
- dialog;
- route/page;
- other existing lightweight surface.

Prefer the least disruptive option consistent with the current UI system.

It should show the selected date prominently and group items by existing meal slot.

Example conceptual hierarchy:

Morning
coffee
oats
banana

Lunch
chicken
buckwheat

Snack
skipped

Dinner
salmon
vegetables

Do NOT mechanically reproduce this example.

Use the application's existing Hebrew slot names and actual design language.

---

# PHASE 4 — ME VS PARTNER

The review must work for both people without becoming visually confusing.

The user should be able to understand:

- MY DAY
- PARTNER'S DAY

Choose a calm interaction model.

Possible patterns include:

- a simple person toggle at the top;
- tabs/chips;
- starting with the currently active person and a one-tap switch.

Do not put both complete long food lists side by side on a phone.

Avoid admin-style user selectors.

Use the existing identity colours/initials/names.

The experience should feel personal:

"שלי / אלנה"
or the appropriate person labels,

not like selecting database records.

---

# PHASE 5 — READABILITY

This is a review screen, not an editor.

Optimize for scanning.

Each logged entry should expose only useful information.

Likely:

- food name;
- quantity/unit when meaningful;
- logged time if available/useful.

Avoid showing technical metadata.

Do not expose IDs.

Do not over-display timestamps.

Use `FoodEntry.loggedAt` only when the underlying value is meaningful.

Do not invent historical timestamps.

---

# PHASE 6 — SLOT STATES

Represent each meal slot faithfully.

Distinguish between:

- entries exist;
- deliberately skipped;
- empty/not documented.

Do not make "not yet logged" look like "skipped".

Keep empty states compact.

The user should be able to scan the whole day without giant empty cards.

---

# PHASE 7 — EDITING

The day review itself should remain primarily read-only.

For MY entries:

provide a quick edit shortcut.

Use the existing MealEditor / slot editing behavior.

Do not create a second editing implementation.

An edit action should take the user to the correct:

- person;
- date;
- slot;
- existing data.

After saving:

return naturally to the review/home context and show updated truth.

Avoid forcing the user through unrelated navigation.

---

# PARTNER EDITING RULE

Be conservative.

The normal experience should NOT casually encourage one partner to rewrite the other's logged food.

Inspect the existing product model and authorization behavior.

If editing partner data is intentionally supported today, preserve existing policy but do not make it prominent.

If ownership rules indicate the partner's review is read-only, keep it read-only.

Do NOT change authorization rules during M2-4 merely to enable partner editing.

Report the current product rule in the final report.

---

# PHASE 8 — TILE STATUS SHORTCUT

Investigate the previous recommendation:

"tap a tile's status pill to see what is inside."

Do not create competing interaction models.

If a slot-level shortcut is useful:

- tapping the tile/status may open the day review scrolled/focused to that slot;

OR

- retain existing tile → editor behavior if it is already the fastest logging interaction.

Preserve fast logging.

Do not degrade the highly optimized tile → quick-add loop just to support review.

A good default may be:

- tile = edit/log;
- TodayCard summary = review.

Choose based on actual current UX.

---

# PHASE 9 — PARTNER RECENCY

The PartnerGlance currently shows the partner's latest item.

Ensure tapping the partner summary can reach the partner's Day Review naturally if that improves discoverability without clutter.

Avoid adding extra buttons solely for this.

One intuitive tap target is enough.

Do not turn PartnerGlance into a navigation menu.

---

# PHASE 10 — EMPTY AND REALISTIC STATES

Visually verify Day Review with:

1. empty day;
2. one logged meal;
3. multiple items in one slot;
4. entries across all six slots;
5. skipped slots;
6. long food names;
7. current user's view;
8. partner's view;
9. past date;
10. current date.

Ensure it remains usable when a meal contains many items.

Avoid excessive vertical whitespace.

---

# PHASE 11 — MOBILE / RTL

Required visual verification:

- 412×915;
- 360×740.

Verify actual browser rendering.

Check:

- Hebrew / RTL;
- mixed Hebrew + numeric quantities;
- times;
- long food names;
- scrolling;
- sticky/fixed elements if used;
- open/close affordances;
- person switch.

No horizontal scroll.

Do not infer RTL defects from terminal output.

---

# PHASE 12 — DATA / PERFORMANCE

Use existing selectors/state where possible.

Avoid:

- N+1 reads;
- one query per slot;
- duplicate partner hydration;
- redundant fetch when opening the review.

If existing home hydration already has all required data, Day Review should render locally from that state.

If it does not, add the smallest coherent data access needed.

Do not redesign sync architecture.

Do not introduce realtime.

---

# PHASE 13 — ACCESSIBILITY

Ensure:

- review entry point has a meaningful accessible name;
- person switch is understandable;
- edit buttons identify their target;
- skipped / empty / logged states are not color-only;
- modal/sheet focus behavior is correct if applicable;
- tap targets remain usable.

Do pragmatic fixes only.

---

# PHASE 14 — TESTS

Add focused deterministic coverage.

At minimum test:

- opens correct selected date;
- shows active person's logged foods;
- switches to partner;
- correctly distinguishes logged / skipped / empty;
- long/multiple entries render;
- edit shortcut opens the correct person's date + slot;
- partner review preserves ownership policy;
- opening/closing review doesn't corrupt selected date/person;
- no duplicate day reads introduced.

Add browser coverage for the complete mobile interaction.

Keep tests aligned with behavior rather than implementation details.

---

# PHASE 15 — VISUAL PRODUCT CHECK

After implementation, inspect the app as a whole.

Ask:

Does Day Review solve a real question immediately?

Or did we just add another screen?

Success means Ariel can:

Home
→ one tap
→ understand today's food
→ optionally inspect Elena
→ fix his own item
→ return.

The interaction should feel almost obvious.

---

# M1

M1 remains YELLOW unless owner production actions have actually occurred.

Do not investigate owner access.

Do not change the existing M1 release procedure.

If unchanged, mention it briefly in the final report.

---

# LOCAL PHONE DATA

No migration.
No deletion.
No import.

M1-R5 remains pending.

Do not work on it during this milestone.

---

# DO NOT ADD IN THIS RUN

Do not add:

- calorie calculations;
- protein calculations;
- nutritional recommendations;
- AI;
- reactions/comments;
- partner notifications;
- social feed;
- streaks;
- gamification;
- new backend tables;
- realtime;
- charts.

This milestone is DAILY VISIBILITY.

---

# GIT

Use coherent commits.

Before push:

- inspect diff;
- remove debug output;
- confirm no credentials;
- run full relevant test suite;
- production build green.

Push completed work to main under the project's existing workflow.

No force-push.

---

# DOCUMENTATION

Follow the existing repo-native system.

Save:

- prompt;
- run report;
- durable product decision if one is made;
- project status;
- todo;
- canonical last-update timestamp.

Avoid redundant documents.

---

# IF M2-4 FINISHES EARLY

Do NOT start implementing a random next feature.

Perform a short evidence-based M2-5 discovery.

Observe the normal daily loop after M2-4 and identify ONE remaining highest-friction problem.

Potential areas:

- finding foods;
- repeat/recent food reuse;
- quantity editing;
- correcting mistakes;
- navigation between dates;
- historical review.

Choose based on actual observed friction.

Document the selected next milestone but do not start a broad new build unless it is an obviously small continuation.

---

# SUCCESS CRITERIA

This run succeeds when:

1. one tap from Home opens a useful day overview;
2. all foods for the day can be reviewed without opening six slots;
3. meal slots remain distinguishable;
4. skipped vs empty remains accurate;
5. switching between me/partner is clear;
6. own entries can reach editing quickly;
7. partner ownership remains safe;
8. no extra backend architecture is introduced;
9. phone UX is visually clean;
10. tests/build stay green;
11. completed work is pushed.

---

# REQUIRED FINAL REPORT

Use exactly:

## STATUS

Overall plus:

- M1
- M2
- repository

## STARTING STATE

Branch, SHA, worktree/origin.

## FRICTION BEFORE

How many interactions were required to understand the full day before M2-4.

## M2-4 IMPLEMENTED

Exactly what changed.

## DAY REVIEW

What is visible and how it is grouped.

## ME / PARTNER

How switching works and ownership behavior.

## EDITING

What can be edited, by whom, and the interaction path.

## SLOT STATES

Logged / skipped / empty behavior.

## DAILY FLOW

Home → Review → Edit → Return.

## MOBILE / RTL

412×915 and 360×740 findings.

## PERFORMANCE

Queries/reads/render behavior relevant to Day Review.

## ACCESSIBILITY

Only meaningful findings/fixes.

## M1

Concise current status.

## TESTS

Exact results.

## GIT

Ending SHA(s), branch and push status.

## DOCUMENTATION

Exact files.

## YOU

Only owner actions genuinely required.

## NEXT

ONE evidence-based M2-5 milestone.

## RUN TIMESTAMP

Exact local date/time and update canonical last-run timestamp.

Work autonomously.
Do not stop because production M1 remains owner-blocked.
