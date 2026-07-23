# Project Status

**Date:** 2026-07-23
**Branch:** main
**Commit before this work:** 542233e (Update site info for publish)
**Phase:** MVP hardening — verified implementation, coffee feature, tests added.

> Rule: nothing is listed as "working" unless it was actually run/verified in this session.

## Stack (verified from the repo)

| Area | Actual |
| --- | --- |
| Framework | TanStack Start (SSR) + React 19 |
| Router | @tanstack/react-router (file-based, `src/routes`) |
| Server state | @tanstack/react-query (provider only; app state is a custom store) |
| Build tool | Vite 8 (`@lovable.dev/vite-tanstack-config`, nitro → Cloudflare target) |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix) |
| Forms/validation | react-hook-form + zod present; nutrition screens use controlled inputs + pure validators |
| Icons | lucide-react |
| Package manager | bun (bun.lock committed); this session used npm to install (bun not present) |
| Tests | **Vitest + Testing Library (added this session)** |
| Backend | **None. No Supabase, no env files, no secrets.** State is an in-memory store with interim localStorage persistence. |

## Quality gate (run this session)

| Check | Command | Result |
| --- | --- | --- |
| Type check | `tsc --noEmit` | PASS — 0 errors |
| Lint | `eslint .` | PASS — 0 errors, 8 warnings (see "Remaining warnings" below) |
| Format | `prettier` | PASS — changed + previously-unformatted source files normalised; `endOfLine: auto` added for cross-platform CRLF |
| Unit/integration tests | `vitest run` | PASS — 77 passed / 16 files |
| Coverage | `vitest run --coverage` | Statements 66.85% · Branches 79.94% · Functions 62.4% · Lines 66.85% (100% on all pure logic modules) |
| Accessibility | `vitest-axe` on 5 key components | PASS — 0 violations (MealCard, CoffeeSelector, ProfileSwitcher, DailyCompletionIndicator, WeightBanner) |
| Build | `vite build` | PASS — SSR + client build succeeds |
| SSR smoke | `vite dev` + curl | PASS — Home renders; profiles אריאל/אלנה, six slots, RTL; no "אני", no "ארוחת לילה"; no hydration warnings |
| Secret scan | grep | PASS — no secrets, no `.env`, no service_role |

### Remaining warnings (8, non-blocking, dev-only)

All are `react-refresh/only-export-components` — a Fast-Refresh (HMR) hint with **no runtime or production impact**. Not suppressed globally.
- 6 in vendored shadcn/ui files that export a variance/util next to the component: `ui/badge.tsx`, `ui/button.tsx`, `ui/form.tsx`, `ui/navigation-menu.tsx`, `ui/sidebar.tsx`, `ui/toggle.tsx`.
- 2 in `src/lib/store.tsx` (the `StoreProvider` component colocated with the `useStore` hook and `PROFILES` const). Kept colocated deliberately — splitting would churn 9+ import sites (the public `@/lib/store` API) for a dev-only hint.

### Accessibility / QA improvements this pass
- `prefers-reduced-motion` reset added to `styles.css` (neutralises animations/transitions).
- Icon-only interactive controls raised to 44px (entry-row favorite/edit/delete, fasting/workout edit).
- MealEditor moves focus into the dialog on open (keyboard + screen-reader).
- axe automated a11y checks added for the key components.

## Working (verified)

- App shell, Hebrew RTL (`lang="he" dir="rtl"`), mobile-first layout, bottom nav, weight banner.
- Profiles: **אריאל** and **אלנה**, one-tap switch, date preserved on switch, data separated per profile (unit-tested).
- Date navigation (prev/next/today, calendar).
- Six meal slots with correct current labels; completeness computed only from the six slots; `skipped` counts as complete (unit-tested).
- Meal editor: add / edit / delete / undo, empty & skipped states, auto-save indicator.
- Food search (debounced, normalized), recent & favorite foods, create-new-food.
- Quantity: measured (positive amount + unit) and subjective (מעט/במידה/הרבה/מוגזם); subjective never converted to a number (unit-tested).
- **Coffee logging (new):** structured type + milk + optional milk-type + quantity + note; validation and milk-type clearing unit-tested; appears in search/recents/favorites; edit/delete/undo; profile & date separated; persists.
- Fasting (midnight crossover, unit-tested), workout, weigh-ins + fat mass + weight delta (unit-tested), weight banner.
- Calendar full/partial/empty with shape + color; fasting/workout/weight do not affect completeness.
- **Interim persistence:** localStorage — refresh / date change / profile switch keep data (unit-tested via fresh remount).

## Not present / deferred (honest gaps)

- **No Supabase / auth / RLS / realtime / offline queue.** These docs describe the intended architecture; none is implemented yet. Persistence is client-only localStorage, explicitly interim (see decisions DEC-013).
- No E2E framework (Playwright) — not added; component/integration coverage via Vitest + Testing Library instead.
- Bottom-nav "history"/"more" and quick-add default slot are placeholders.

## Risks

- R1 — Persistence is local-only; a new device / cleared storage starts empty. Real multi-device sync needs Supabase.
- R2 — SSR hydration renders the seed first, then swaps to persisted state on mount (brief, expected).
- R4 — Single source for day completeness is `src/lib/completion.ts`, shared by home + calendar (good).

## Next step

Connect Supabase (schema per `docs/03-architecture.md`) behind the existing store API and replace the localStorage layer; keep the pure domain modules (`completion`, `coffee`, `fasting`, `weight`, `quantity`) as the shared logic.
