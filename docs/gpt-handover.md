# GPT Handover

Continuity handover across tools. Updated **2026-07-25** — production bootstrap session closed.

> Any future GPT must rely on the documentation in this repository, not on conversation memory.
> On conflict, the newest user instruction wins, then `project-status.md`, then this file.

---

## 1. Product purpose

A shared Hebrew, RTL, mobile-first **nutrition logging** app for two people: **אריאל (Ariel)** and
**אלנה (Elena)**. The purpose is fast, calm, reliable daily logging — **not** analysis. The tone is
neutral and non-judgmental, status is never communicated by colour alone, and no food is ever labelled
good, bad, healthy or forbidden.

## 2. Current production state

**The project is no longer in a specification-only or bootstrap stage. The database is live.**

- The production bootstrap **has completed**, applied once manually in the Supabase SQL Editor, with a
  final report of `READY`.
- The **390-food Hebrew catalog is live** in the database.
- **No further SQL action is pending.** Do not instruct the user to rerun the migration.
- The single remaining check is the user's **first real-use interaction** in the app.

| households | memberships | profiles (אריאל/אלנה) | meal slots | RLS tables | active foods | transactional logs | status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | 2 | 6 | 10 | **390** | 0 | **READY** |

## 3. Repository and commits

- **Branch:** `main` · **Remote:** `https://github.com/arieldeitch/my-elenas-plate.git`
- **HEAD at session close:** `90df85f` — synchronized with `origin/main`.
- Relevant commits from this work:
  - `6768c99` feat(foods): add production Hebrew catalog and safe seed migration
  - `82de378` docs(migration): clarify atomicity and rollback
  - `d018725` style(auth): fix pre-existing prettier error in SignIn
  - `7d8ce50` fix(supabase): add bootstrap script so the catalog seed has a household to seed
  - `90df85f` docs: record the applied Supabase setup and the zero-row root cause
- **Rollback code checkpoint:** tag `pilot-ready-2026-07-24` → `29ac1d5`.
- Working tree clean apart from two intentionally-untracked items: the reference folder
  `nutrition-tracker-knowledge-pack-complete/` and `my-elenas-plate.code-workspace`.
- No secrets tracked. Only `.env.example`; `.env`, `.env.e2e`, Playwright artifacts,
  `package-lock.json` and `coverage/` are gitignored.

## 4. Supabase state

- **Project reference:** `rqgoiuztphkcvbwtbxbj`. The application configuration points at it (verified in
  the client module the running app actually loads, not only in `.env`).
- All schema, RLS and bootstrap migrations are applied; RLS is enabled on all 10 relevant tables and
  was re-confirmed after the bootstrap (anonymous reads return empty; the bootstrap RPC rejects
  unauthenticated calls).
- Applied operational SQL: the cleanup/seed migration plus `supabase/bootstrap_and_seed.sql`.
- **Read-only verification** for any future doubt: `supabase/verify_catalog.sql`. It writes nothing and
  can be run any number of times.
- **Why the first SQL report showed zeros** (important, so it is never misdiagnosed again): the catalog
  seed inserts one row **per household** (`from public.households h cross join catalog c`), and the
  project had the full schema but **no household**, because `bootstrap_household()` only runs when an
  account signs in and that had never happened there. The seed therefore correctly inserted 0 rows. The
  migration was never at fault, and running it twice was harmless — its only `DELETE` against `foods`
  targets the exact literal `מאכל בדיקה`, so it can never remove a seeded catalog.

## 5. Household and profiles

- One shared household, one shared Auth account model (DEC-017): two **internal** profiles, not two
  Auth users. Data is separated by `profile_id`; the shared account can edit both.
- Profiles: **אריאל** and **אלנה** (internal ids remain `me` / `elena`; slugs `ariel` / `alena`).
  The word "אני" must never appear in the UI.
- Two household memberships exist.
- Both profiles use the same product structure and share one food catalog.
- Six meal slots (fixed order and labels): פתיחת חלון אכילה · נשנוש ראשון · ארוחה מרכזית ·
  נשנוש אחר הצהריים · ארוחת ערב · ארוחה נוספת. "ארוחת לילה" must not appear.

## 6. Food catalog

- **390 active Hebrew items across 14 categories**, covering foods, drinks, ingredients, spreads,
  snacks, dishes, vegetables, fruits, dairy, eggs, grains, breads, legumes, meat, poultry, fish, sauces
  and common Israeli meals.
- **No** calories, macros, health labels, quality scores, goals or nutrition recommendations — by
  decision (DEC-004, DEC-009), not by omission.
- The bootstrap created **no** Favorites, Recents or Food Entries.
- **Supabase is the source of truth** (DEC-019). The TypeScript modules under `src/data/foods/` are the
  canonical *definition*: they generate the seed SQL and act as the offline / pre-seed fallback. They
  must **not** be documented as the primary production source.
- Per-food practical units (e.g. גבינה צהובה = פרוסה/גרם, מים = מ״ל/כוס/ליטר); the default unit is
  always one of the offered units.

## 7. Search and normalization

- `src/lib/food-normalize.ts` — one normalization key used consistently for search, duplicate
  prevention and the `normalized_name` column: Hebrew niqqud removal, whitespace normalization,
  punctuation normalization, geresh and apostrophe variants, Hebrew spelling normalization as required
  by the implemented tests, and Latin lowercase where relevant. Idempotent; no alias subsystem.
- `src/lib/food-search.ts` — ranked search with a result limit, so the full catalog is never rendered.
- Duplicate prevention: creating a custom food whose normalized name already exists reuses the existing
  food instead of creating a twin.
- Automated search coverage: מלפפון · עגבניה · עגבנייה · גבינה צהובה · שניצל · אורז · חזה עוף · סלט ·
  מים · קפה · קוטג · פיתה · טחינה.

## 8. Mock-data cleanup

- `src/lib/demo-data.ts` was **removed**.
- The production store no longer initializes with demo nutrition records — it starts empty in every mode.
- The stale local-snapshot path that could repopulate cloud data was **disabled**.
- At the verified production baseline there were no mock meals, meal statuses, fasting logs, workout
  logs, weigh-ins, favorites or recents.
- Cleanup logic uses **explicit fingerprints**, never broad date-based deletion. Ambiguous records are
  preserved rather than deleted, and Auth users, households, profiles, memberships, meal slots, RLS and
  real user data are protected.

## 9. Quality checks

Verified 2026-07-25: TypeScript typecheck 0 errors · ESLint 0 errors (8 pre-existing development-only
HMR warnings) · **186 automated tests passing**, 2 gated live suites skipped · Vite production build
passing · Prettier clean · deterministic catalog SQL generator verified · no secrets or environment
files committed.

(The 186 figure supersedes the 173 reported at `6768c99`; the bootstrap-script tests were added after
that commit.) Playwright E2E passed on 2026-07-24 but is deliberately **not** run against this project —
it signs up fresh `e2e_*` accounts, which would create extra households.

## 10. Decisions currently active

See `decisions.md` for the full records. The ones that govern current work:

- **DEC-001 / DEC-017** — Supabase is the source of truth; one shared Auth account + two internal profiles.
- **DEC-002** — one household containing two profiles.
- **DEC-003 / DEC-007** — daily completeness comes from the six meal slots only; `skipped` counts as complete.
- **DEC-004 / DEC-009** — no calories or macros; non-judgmental tone.
- **DEC-006** — measured and subjective quantities are stored exactly as entered.
- **DEC-014** — coffee is a normal food entry with structured attributes.
- **DEC-018** — `food_preferences.food_id` is a text app id, so built-in and custom foods can be
  favorited/recented uniformly.
- **DEC-019** — catalog ownership: Supabase is authoritative; the TypeScript catalog is the canonical
  definition, seed generator and offline fallback.
- **DEC-020** — one Hebrew normalization function for search, duplicate prevention and `normalized_name`.
- **DEC-021** — the production bootstrap migration is one-time and must not be rerun as routine startup
  or troubleshooting.

## 11. Scope exclusions

Not in scope, and must not be added without an explicit decision: dashboard, calories, macros, goals,
nutrition scoring, recommendations, notifications, gamification, voice input, image recognition,
wearables, Agents, household expansion beyond the two profiles, separate Auth users per profile.

## 12. User working style

- Communicate **in Hebrew**. The user is **non-technical**.
- Minimize manual instructions; give **one simple action at a time**; prefer automation.
- Do not ask the user to use Git, Terminal, CLI, migrations, SQL, environment variables or database
  credentials unless genuinely unavoidable.
- Do not ask for confirmation on standard technical decisions.
- Factual, non-judgmental tone; avoid unnecessary explanation of internal implementation.

## 13. Known limitation

Claude never authenticated through the user's actual application account, because the password was
unavailable and a throwaway account would have created a second household. Therefore the following were
**not personally observed by Claude** in an authenticated browser session — do not claim otherwise:

- visible switching between אריאל and אלנה,
- adding a food through the real UI,
- refreshing and observing persistence through the user account,
- live Recent and Favorite behaviour through the user account.

All of it is covered by automated tests at the logic and component level. This is **not** a blocker; the
user's first real food entry functions as the final authenticated smoke test.

## 14. Risks

1. The first authenticated UI interaction has not yet been directly observed.
2. The user may discover a UI-only issue during first use.
3. The successful bootstrap SQL must not be rerun unnecessarily.
4. Future schema or seed changes must continue through new forward-only migrations.

## 15. First next step

Process the outcome of the user's **first real logging session**: profile switching, food search,
saving an entry, and persistence after refresh. If a problem appears, capture the visible behaviour and
continue from the current production baseline **without rerunning migrations**.

## 16. Prompt for continuing with Claude Code

```
Read the active documentation in docs/ (claude-context.md, project-status.md, todo.md, decisions.md).
Verify Git state only — current branch, HEAD and git status, read-only.

Do NOT rerun any migration, do not reseed the food catalog, and do not reset the database. The
production bootstrap for Supabase project rqgoiuztphkcvbwtbxbj is already complete and verified:
1 household, 2 profiles (אריאל/אלנה), 6 meal slots, RLS on 10 tables, 390 active foods, status READY.
Continue from that completed production baseline.

The first task is to process the result of the user's first real logging session, or any issue they
report. If verification is needed, use the read-only supabase/verify_catalog.sql — never the bootstrap.
Communicate with the user in Hebrew; they are non-technical, so avoid asking for SQL, Terminal or Git
actions and give one simple step at a time.
```

---

## Appendix A — MVP scope as built

Two profiles · six meal slots · `unmarked/logged/skipped` (skipped counts as complete) · daily
completeness from the six slots only · measured + subjective quantity stored as entered · coffee
(structured type/milk/milkType/note) · fasting (16:8, midnight crossover) · workout · weigh-ins (fat
mass, delta) · weight banner · calendar (full/partial/empty, shape + colour) · recent, favorite and
custom foods · Supabase sync (auth, RLS, realtime, offline queue).

## Appendix B — Branding (done in Lovable)

Wordmark **"בריאותי"** (`BrandMark`); calm healthcare pastel system (green primary `#17A668`, info blue,
per-slot soft tints, soft shadows, rounded cards, ≥12px content floor); per-slot lucide icons and status
pills; RTL mobile-first layout. `BrandIllustration` provides `header` / `auth` / `empty-state` /
`loading` variants. Still optional: wire the `empty-state` variant into the six meal tiles, plus light
motion that respects `prefers-reduced-motion`.

## Appendix C — Historical: bugs fixed during browser E2E (T-028, 2026-07-24)

Kept for context only. Editor view resetting on re-render; demo seed leaking into fresh cloud accounts;
dirty-flag cleared before push (offline loss) and hydrate overwriting optimistic edits; mutations lost
during the activation window; no retry after an interrupted activation; realtime channel-name collision;
weigh-in inputs missing labels; realtime socket missing its JWT under RLS.
