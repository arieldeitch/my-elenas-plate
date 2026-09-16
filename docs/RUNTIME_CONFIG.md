# Runtime configuration and build identity

**Status:** Accepted for M1 (recovery/m1-shared-truth)
**Related:** `docs/claude-tasks/M1_SHARED_TRUTH_RECOVERY.md` Phase A, `docs/NO_LOCAL_DOCKER_POLICY.md`

## 1. The two runtime modes

The application decides at **build time** (Vite `import.meta.env`) where data lives:

| Mode    | Condition                                                          | Source of truth               | What the UI says                                                                    |
| ------- | ------------------------------------------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------- |
| `cloud` | `VITE_SUPABASE_URL` **and** `VITE_SUPABASE_ANON_KEY` are non-empty | Supabase (shared household)   | "הנתונים נשמרים בענן המשותף ומסונכרנים בין המכשירים." + `build <sha> · cloud`       |
| `demo`  | either variable is empty/absent                                    | this browser's `localStorage` | "מצב הדגמה — ללא סנכרון ענן" (dev) / red alert "הבנייה הזו אינה מחוברת לענן" (prod) |

Implementation: `src/lib/build-info.ts` (`getBuildInfo()`), rendered by
`src/components/nutrition/RuntimeModeNotice.tsx`. The page `<title>` says
"גרסת הדגמה" only in demo mode.

A **production bundle without Supabase configuration** (`import.meta.env.PROD`
and demo mode) is treated as a misconfiguration: `role="alert"` banner,
`console.warn`, `data-runtime-mode="misconfigured"`. It can never look like a
healthy connected build.

## 2. Build identity

`vite.config.ts` injects two public, non-secret values into every bundle:

- `VITE_BUILD_SHA` — resolution order: `process.env.VITE_BUILD_SHA` (supplied by
  the build environment) → `git rev-parse --short HEAD` → `"unknown"`.
- `VITE_BUILD_TIME` — ISO timestamp of the build.

They are observable in three places on the running app:

1. footer text `build <sha> · <mode>` (and `data-build-sha` on the notice element);
2. console on load: `[elenas-plate] build=<sha> builtAt=<time> mode=<mode>`;
3. `window.__ELENAS_PLATE_BUILD__` (`{ sha, builtAt, mode, productionBuild, misconfigured }`).

Verified locally: `npm run build` on commit `2624a52` embeds `2624a52` in
`.output/public/assets/routes-*.js`.

## 3. How Lovable production receives the variables (no secrets in Git)

- `.env`, `.env.*` are git-ignored (`.gitignore`); only `.env.example` is tracked
  with empty values. Never commit real values.
- The anon key is a **publishable** key by design (RLS protects data); the
  `service_role` key must never appear in any `VITE_*` variable or frontend code.
- Lovable builds the project from the connected Git branch. Public runtime values
  are provided as **project environment variables in the Lovable project
  settings** (or, equivalently, the Lovable Supabase connector, which sets the
  same `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` pair). Because the values
  are read by Vite at build time, **a publish is required after changing them**.
- `VITE_BUILD_SHA` is optional in Lovable. When it is not provided, the build
  falls back to `git rev-parse --short HEAD` inside the Lovable build sandbox; if
  git is unavailable there, the app shows `build unknown`, which is itself the
  signal that the publish pipeline is not passing identity through.

## 4. How to verify what production is actually running (read-only)

1. Open the published app, sign in, and read the footer: it must show
   `build <sha> · cloud`. `· demo`, a red alert, or the title "גרסת הדגמה" means the
   published build has no Supabase configuration → **blocker, report it**.
2. Compare `<sha>` with `git log --oneline` on `main` / the published branch.
3. In devtools: `window.__ELENAS_PLATE_BUILD__` and the `[elenas-plate] build=…`
   console line.
4. Optionally confirm the Supabase host in the network tab is
   `rqgoiuztphkcvbwtbxbj.supabase.co` (production project). Do not write test data.

**Status as of 2026-09-16:** not yet verified — the M1 branch has not been
published (publishing is manual through Lovable and out of scope for the
autonomous run). Until a build containing `RuntimeModeNotice` is published, the
production runtime configuration remains **unverified**.

## 5. Local / test modes

- `npm run dev` — uses `.env` (currently points at production; treat as read-mostly).
- `npx vite dev --mode hermetic` / `npm run e2e:hermetic` — forces demo mode
  regardless of `.env*`; cannot contact any Supabase project. Used for the
  hermetic Playwright tests.
- `npm run e2e` (`--mode e2e`) — loads `.env.e2e`, which **must** point at the
  isolated hosted Supabase test branch (not production, not local Docker).
- Vitest — `src/test/setup.ts` blanks the Supabase env; cloud-path tests mock
  the client module and use `src/test/fake-supabase.ts`.
