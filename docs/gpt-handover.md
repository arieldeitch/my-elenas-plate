# GPT Handover

High-level handover for continuity across tools. Updated 2026-07-23.

## Product

Shared Hebrew RTL, mobile-first nutrition **logging** app for **אריאל** and **אלנה**. Purpose:
fast, calm, reliable daily logging. Out of scope (phase one): calories, macros, goals, scoring,
dashboards, recommendations, gamification. Tone is neutral and non-judgmental; status is never
communicated by color alone.

## Current state (verified 2026-07-23)

- Stack: TanStack Start (SSR) + React 19, Vite 8, Tailwind 4, shadcn/ui, lucide-react,
  @supabase/supabase-js. Tests: Vitest + Testing Library + vitest-axe.
- **Backend: Supabase implemented, opt-in via env.** One shared Auth account + two internal profiles
  (אריאל/אלנה), data separated by `profile_id`. Migrations (schema + RLS + bootstrap + realtime) were
  live-verified on a local Supabase stack (RLS isolation + bootstrap: 5/5). App layer + gated store sync
  + offline queue + local→cloud migration are in place. Without `VITE_SUPABASE_URL` +
  `VITE_SUPABASE_ANON_KEY` the app runs in local demo mode (localStorage). See DEC-017.
- Quality gate all green: type check, lint (0 errors, 8 dev-only HMR warnings), 102 tests (+5 live-RLS
  skipped without env), automated a11y (0 violations), build, SSR smoke.
- Not yet done: browser end-to-end (sign-in + realtime across two sessions) — needs live credentials.

## Latest product decisions (active)

- Profiles are אריאל and אלנה; "אני" must never appear.
- Six fixed meal slots: פתיחת חלון אכילה / נשנוש ראשון / ארוחה מרכזית / נשנוש אחר הצהריים /
  ארוחת ערב / ארוחה נוספת. "ארוחת לילה" removed.
- Day completeness = six slots only; `skipped` counts as complete; fasting/workout/weight/coffee
  do not affect it unless logged as an entry.
- **Coffee is an approved MVP feature**: structured type + milk (+ optional milk type) + quantity +
  optional note, stored on the food entry (`FoodEntry.coffee`), shown in recents/favorites/search.

## What was done this session

1. Fixed the lint/format gate (cross-platform EOL, removed `any`, normalised formatting).
2. Extracted pure, tested domain modules: completion, coffee, fasting, weight, quantity.
3. Implemented structured coffee logging end-to-end (model, validation, UI, persistence, tests).
4. Typography floor: no content text below 12px; unified captions/secondary text.
5. Added Vitest + Testing Library and 54 tests.
6. Added interim localStorage persistence (SSR-safe).
7. Fixed a real bug: `removeEntry` returned `undefined`, breaking the undo toast.
8. Updated docs (`project-status`, `todo`, `claude-context`, `gpt-handover`, `decisions`,
   plus coffee/meal-name updates in `01`/`03`).

## Recommended next step

Introduce Supabase behind the existing store API (`src/lib/store.tsx`): schema + RLS +
generated types + migrations, then swap the localStorage layer for it. Follow the global
Approval-Brief rule before any Supabase/auth/RLS/schema/secret/env change. Keep the pure domain
modules as shared logic.
