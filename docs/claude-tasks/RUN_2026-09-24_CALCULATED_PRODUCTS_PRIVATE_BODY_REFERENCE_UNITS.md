# RUN 2026-09-24 — calculated products, private body progress, reference-derived unit conversions

## Owner intent

This task captures Ariel's 2026-09-24 product requirements. Implement them in the existing nutrition app without rebuilding the product, without changing the two-profile household model, and without weakening DEC-036/DEC-037 history/provenance guarantees.

The app remains a shared Ariel + Elena nutrition product. GitHub is implementation truth. Supabase is runtime-data truth. Do not publish or apply a production migration as part of this task unless separately approved.

## A. Manual/external-calculator product by total points + total weight

Add a third non-canonical way to add a food/product, alongside:
1. canonical points-reference food;
2. label-estimated product;
3. NEW: a manually calculated product whose total points were calculated externally.

Use case:
- name: מרק עוף
- total calculated points: e.g. 52
- total prepared weight: e.g. 2 kg / 2000 g
- the app derives points per gram deterministically;
- later logging 300 g scales from that stored basis.

Requirements:
- this must NOT write into food_reference_items / food_reference_aliases;
- preserve exact entered basis: name, total points, total weight, created_by_profile_id, timestamps, model/source marker;
- points_per_gram = total_points / total_weight_g at full precision; round only at the existing meal-log boundary;
- clearly mark this source in UI, e.g. "חישוב חיצוני" / "חישוב ידני";
- allow direct logging by weight;
- make it reusable in search and, where the current DEC-037 architecture naturally supports it, as a dish ingredient;
- editing must not rewrite historical meal snapshots;
- archive/restore rather than destructive delete where practical;
- validate positive finite points/weight and support kg↔g input.

Choose a clean derived household-scoped entity/schema rather than polluting the canonical reference or overloading label-estimate semantics.

## B. Private body-progress area per internal profile, protected by PIN

The app already has weigh_ins and WeighInForm. Reuse/migrate existing data; do NOT create a parallel history that loses prior entries.

Owner experience:
- no new user-account management;
- enter the body-progress area, choose/see the existing profile name (Ariel / Elena), then unlock with a short numeric PIN;
- PIN should be 4–6 digits (prefer 6 in the UI recommendation);
- each profile has its own PIN;
- body data is private by default and must not appear in PartnerGlance / partner day views / shared realtime surfaces;
- do not make this a cosmetic client-only lock if the shared Supabase Auth account can still directly read the other profile's body history. The backend boundary must match the privacy promise.

Data:
- weight: required;
- body-fat %: optional;
- date/time;
- preserve existing weigh_ins rows/history.

Views after unlock:
1. **Trend / cuts view** — compact, mobile-first, with useful time windows (e.g. 30d / 90d / 1y / all; choose a minimal set that fits the UI), showing weight trend and, when present, body-fat trend. Derived fat mass may be shown because the app already computes it.
2. **Progress feed** — reverse chronological list of weigh-ins, showing date/time, weight, optional body-fat, and useful change versus the previous relevant measurement.

Privacy/security constraints:
- current household uses one shared Auth account + two internal profiles. Therefore profile_id alone is not privacy.
- implement a server-enforced PIN gate or equivalent backend-enforced boundary for body-history reads/writes;
- never store the raw PIN;
- use a salted one-way password hash supported by the backend (e.g. pgcrypto crypt/bcrypt or equivalent);
- authenticated household membership is still required in addition to the PIN;
- direct table grants/policies must not let the shared authenticated client bypass the PIN-gated path;
- preserve offline/shared nutrition behavior outside this private area;
- avoid persisting the PIN in localStorage. Keep unlock state bounded to the current session/view and relock on a sensible boundary.
- preserve or migrate existing rows safely and add tests for cross-profile access denial.

This is intentionally NOT full user management and NOT a new auth-account model.

## C. Fix the unit problem using the canonical Weight-Watchers-style reference data

Problem:
DEC-036 deliberately became conservative: one selected reference portion can make other unit choices unavailable. This is now too restrictive for real use.

Desired behavior:
If the source itself contains a weight equivalence, use it. Example:
- reference says "1 כף / 15 גרם";
- user enters 30 גרם;
- app should transparently calculate that as 2 tablespoons' worth of the same reference portion and score accordingly.

Important discovery in the current code:
- quantity-parse.ts already parses forms such as "1 כף / 15 גרם" and stores explicit grams/ml on ReferencePortion;
- engine.ts already scales by grams when portion.grams exists;
- keep and expose this behavior in the UI end-to-end.

Extend beyond the same-cell case, cautiously:
- for the SAME active reference group only, when the reference provides separate count and weight rows that can support a coherent relationship, the app may derive an approximate unit↔weight equivalence from the canonical source;
- label that conversion as an estimate from the reference ("הערכה מהמאגר"), not as an exact physical density fact;
- do not bridge different normalized foods, brands/variants, raw/cooked states, or unsafe alias boundaries;
- never derive from conflict / needs_review / deprecated rows;
- do not derive from zero-point rows or mathematically underdetermined cases;
- if sibling rows imply inconsistent conversions beyond a documented tolerance, do not guess: fall back to the existing explicit manual weight-bridge flow;
- user-measured / package-label bridges remain valid and should take precedence over a weaker inferred reference bridge;
- explicit same-cell source equivalence ("1 כף / 15 גרם") is stronger than cross-row inference and should be represented as source-explicit, not "guessed";
- make grams and kg available in QuantitySelector whenever the selected/source group can resolve them;
- if no safe/usable conversion exists, explain the missing bridge and offer the existing bridge form instead of a dead end;
- persist enough conversion provenance in dish ingredient snapshots / meal basis so historical entries do not change if source data or bridge rules change later.

A useful precedence order:
1. direct same-source-cell equivalence (explicit);
2. user/package bridge already stored for this exact source identity;
3. coherent same-group reference-derived estimate;
4. otherwise blocked + offer bridge capture.

If the implementation finds a safer precedence based on current architecture, document why, but the user outcome above is binding.

## UX requirements

- Hebrew, RTL, mobile-first, compact first glance.
- Do not add unnecessary navigation complexity.
- New source labels must be human-readable; do not expose internal model ids as the primary label.
- The private body area should feel like a focused personal space, not an admin panel.
- The main shared nutrition experience must remain fast.
- Use existing components/styles and preserve the calm visual language.

## Data / migration / release safety

- Additive/forward-only migration where possible.
- Preserve all production food_entries and weigh_ins.
- No production data rewrite without an explicit migration and verification path.
- No production deployment/publish in this run.
- Update generated Supabase types, repository/mappers/sync boundaries as needed.
- For private body metrics, remove any direct client path that bypasses the PIN boundary.
- No secrets in browser or repo.
- Keep Docker/local Supabase prohibited by project policy; use hermetic tests + hosted isolated branch / PGlite where appropriate.

## Required tests / acceptance

At minimum cover:
1. manual-calculated product: 52 points / 2000 g → 1000 g = 26 before normal meal rounding rules; 300 g scales deterministically; history remains unchanged after product edit;
2. kg and g entry produce equivalent results;
3. source cell "1 כף / 15 גרם": 30 g resolves to scale 2 and correct points;
4. same-group inferred bridge works only when evidence is coherent and is visibly marked estimated;
5. inconsistent sibling evidence refuses inference and offers/uses manual bridge;
6. manual explicit bridge wins over weaker inferred bridge;
7. no cross-food / cross-variant bridge leakage;
8. body area remains locked without correct PIN;
9. wrong profile PIN cannot read or write the other profile's body history;
10. shared household Auth alone cannot directly bypass the private body boundary;
11. existing weigh_ins remain visible to their owner after migration;
12. weight required, body-fat optional;
13. trend windows and progress feed render correctly with sparse body-fat data;
14. normal shared meals/partner glance still work and do not expose private weight/body-fat;
15. realtime/sync does not leak private body rows into the partner shared store.

Run existing quality gates plus focused new unit/integration/E2E coverage. Do not claim green without evidence.

## Documentation

Create a new decision record (next DEC number) that documents:
- calculated-product provenance;
- private body/PIN boundary under one shared Auth account;
- explicit vs inferred reference unit conversion precedence;
- historical snapshot invariants.

Update project-status / todo / relevant ADR docs and the run report. Keep this file as the owner-intent traceability source.

## End-of-run report

Return:
- STATUS;
- USER OUTCOME;
- IMPLEMENTED;
- DATA/MIGRATION;
- PRIVACY GATE;
- UNIT-CONVERSION GATE;
- TESTS;
- LIVE/DEPLOYMENT (must remain not published/not applied unless separately approved);
- RISKS / FOLLOW-UPS;
- OWNER ACTION (only genuine required action);
- final commit/PR identifiers.
