# Task prompt — run of 2026-09-18 (tenth run, access simplification) — verbatim as received; list markers may be normalized by prettier

Continue the Nutrition App directly from the current repository state.

Expected starting point:

`main @ d693a5b`

Verify actual HEAD / origin / worktree first.

This is a real-device product finding and it takes priority over starting the M2-7 pilot.

# PRODUCT DECISION

The visible Supabase login introduced during M1 is a product regression.

This application is a private, low-friction couple nutrition tracker.

Ariel's original application did not require a password, and the new cloud version must not force Ariel or Elena through:

- email entry;
- passwords;
- magic-link flows;
- account creation;
- repeated sign-in screens.

The desired experience is:

OPEN APP
→ silent backend connection
→ choose ARIEL / ELENA once per device
→ use the app.

Subsequent opens should go directly into the app.

# TARGET ARCHITECTURE

Prefer:

**Supabase Anonymous Auth**

not:

- public unauthenticated CRUD;
- service-role keys in the client;
- a hard-coded shared password;
- bypassing RLS;
- local-only mode.

Supabase anonymous users receive real authenticated sessions and therefore can continue using the existing RLS / Realtime model.

Do not solve this by granting unrestricted database access to the public `anon` Postgres role.

# PHASE 1 — INSPECT CURRENT AUTH FLOW

Current known state includes:

- `src/components/auth/AuthGate.tsx`
- `src/components/auth/SignIn.tsx`
- `src/lib/supabase/auth.ts`
- `src/lib/sync/use-supabase-sync.tsx`
- `bootstrap_household()`
- household membership via `household_users`
- profile selection stored per device.

Inspect the exact current implementation before changing it.

Document why the current permanent-user/shared-account login was introduced and which guarantees must be preserved.

# PHASE 2 — SILENT ANONYMOUS SESSION

When the production Supabase runtime is configured:

1. check for an existing session;
2. if one exists, reuse it;
3. if no session exists, call Supabase anonymous sign-in automatically;
4. show only the existing neutral loading state while this happens;
5. never show SignIn during the normal path.

There should be no visible authentication form.

Add a small, user-friendly failure state only if silent connection genuinely fails.

Example intent:

"לא הצלחנו להתחבר כרגע. נסה שוב."

with one Retry button.

Do not expose Supabase terminology.

# PHASE 3 — HOUSEHOLD JOIN SEMANTICS

CRITICAL:

Every anonymous device gets a different `auth.uid()`.

The current `bootstrap_household()` creates a new household when a new auth user has no membership.

That behavior is NOT acceptable for the couple app.

Change the bootstrap/join logic so that new anonymous device identities join the EXISTING Ariel + Elena household.

Requirements:

- existing permanent/shared-account membership remains valid;
- existing household and existing Ariel/Elena profiles are reused;
- no duplicate household;
- no duplicate Ariel/Elena profiles;
- anonymous device user gets a `household_users` membership;
- operation is idempotent;
- repeat app opens create nothing;
- second phone joins the same household;
- third fresh browser session also joins the same household, not a new one.

This application intentionally supports one shared household.

Do not generalize it into a multi-tenant household invitation platform.

# PHASE 4 — SECURITY MODEL

Preserve:

- RLS on all 10 tables;
- household membership as the data-access boundary;
- no service-role key in browser;
- existing shared-truth / Realtime behavior.

Anonymous Supabase Auth users use the authenticated database role.

Review all current RLS policies under that fact.

Do not grant broad CRUD to the unauthenticated `anon` database role merely to avoid login.

If an RLS adjustment is needed, create the smallest explicit migration.

# PHASE 5 — DEVICE IDENTITY

Authentication identity and product profile are separate concepts.

The anonymous Supabase user identifies the device/session.

The product profile remains:

- אריאל
- אלנה

On first use of a fresh device:

silent connection
→ existing device/profile chooser
→ user chooses Ariel or Elena.

Persist that device choice exactly as the current product intends.

On future opens:

- reconnect silently;
- restore that device's chosen person;
- go directly to Home.

Do not ask "who are you?" every time.

# PHASE 6 — REMOVE LOGIN UX

The normal application must not show:

- email;
- password;
- "קישור לאימייל";
- "כניסה לחשבון המשותף";
- account registration.

Remove or retire `SignIn` from the production flow.

Do not necessarily delete useful auth helpers if they are still needed for migration/recovery, but they must not be part of normal UX.

If a developer/recovery login path is retained, keep it out of the ordinary UI and document it.

# PHASE 7 — SESSION LOSS

Anonymous sessions cannot be recovered after local browser storage is cleared.

That is acceptable for this product because data belongs to the household, not to the anonymous device user.

Expected recovery:

fresh session
→ automatically joins existing household
→ user chooses Ariel / Elena again
→ cloud data appears.

No historical cloud data should be lost.

Test this explicitly.

# PHASE 8 — LEGACY LOCAL DATA

Preserve the established M1-R5 behavior.

Do not import old `elenas-plate:v1` data automatically.

Do not delete it.

A fresh anonymous cloud session must still hydrate from cloud truth only.

# PHASE 9 — REALTIME

Verify that anonymous-authenticated sessions still carry the access token into Realtime.

Two independent anonymous sessions must be able to:

Device A / Ariel:
add food

Device B / Elena:
see partner update within seconds.

This is mandatory.

Do not trade away realtime merely to simplify authentication.

# PHASE 10 — SUPABASE CONFIGURATION

Anonymous sign-in must be enabled on production Supabase.

Do NOT ask Ariel to configure Supabase manually.

Your responsibility in this run:

- determine the exact project configuration requirement;
- implement all repo-side code/migrations;
- clearly report any backend setting that cannot be applied from this Claude session.

Do not invent a workaround that weakens the architecture solely because Claude lacks permission to change an Auth provider setting.

The controlling GPT environment has direct access to the production Supabase project and will apply/verify the backend change after this run if needed.

# PHASE 11 — TESTS

Add deterministic coverage for:

1. existing session → no new sign-in;
2. no session → anonymous sign-in invoked;
3. silent sign-in failure → simple retry state;
4. first anonymous user joins existing household;
5. second anonymous user joins SAME household;
6. no duplicate profiles;
7. profile/device choice persists;
8. clearing auth/session storage creates a fresh device identity but recovers same household;
9. Ariel data stays Ariel;
10. Elena data stays Elena;
11. cross-device realtime still works;
12. legacy local snapshot is not imported;
13. no visible normal login form.

Update hermetic/browser tests where appropriate.

# PHASE 12 — PRODUCTION ACCEPTANCE PLAN

Do not mark the current M1 phone acceptance complete yet.

The auth experience has changed.

Prepare a new short acceptance path:

Fresh phone/browser
→ open URL
→ no login form
→ choose Ariel/Elena
→ Home
→ log item
→ synced
→ second device sees it.

This should take under two minutes per device.

# UX SUCCESS CRITERIA

Ariel should be able to send Elena the application URL.

She opens it.

She should NOT need:

- an email address;
- Ariel's email;
- a password;
- an OTP;
- a magic link.

She chooses **אלנה** and starts using the app.

That is the product requirement.

# DO NOT

Do not:

- make all Supabase tables publicly writable;
- embed `service_role`;
- hard-code an email/password pair into the frontend;
- create a second household per device;
- redesign the nutrition product;
- add M2-8 features;
- change daily logging UX.

This run is ACCESS SIMPLIFICATION ONLY.

# GIT / DOCUMENTATION

Use coherent commits.

Update:

- project status;
- TODO;
- decisions;
- M1 / M2-7 acceptance docs;
- Claude context;
- run prompt/report;
- last-run timestamp.

Record this as a deliberate product correction based on real-device feedback.

# REQUIRED FINAL REPORT

## STATUS

## STARTING STATE

## CURRENT LOGIN PROBLEM

## NEW ACCESS FLOW

## ANONYMOUS AUTH

## HOUSEHOLD JOIN

## RLS / SECURITY

## DEVICE PROFILE

## SESSION RECOVERY

## REALTIME

## SUPABASE BACKEND REQUIREMENT

Be exact about anything the controlling GPT still needs to apply.

## TESTS

## GIT

## DOCUMENTATION

## YOU

This should contain no manual Supabase action for Ariel.

## NEXT

Only:
apply/verify backend requirement if needed → publish → two-phone acceptance → M2-7.

## RUN TIMESTAMP

Work autonomously.
Do not start unrelated feature work.
