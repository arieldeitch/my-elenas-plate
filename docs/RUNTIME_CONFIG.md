# Runtime configuration and build identity

**Status:** Accepted for M1 (recovery/m1-shared-truth)
**Related:** `docs/claude-tasks/M1_SHARED_TRUTH_RECOVERY.md` Phase A, `docs/NO_LOCAL_DOCKER_POLICY.md`

## 1. The two runtime modes

The application decides at **build time** (Vite `import.meta.env`) where data lives:

| Mode    | Condition                                                          | Source of truth               | What the UI says                                                                      |
| ------- | ------------------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------- |
| `cloud` | `VITE_SUPABASE_URL` **and** `VITE_SUPABASE_ANON_KEY` are non-empty | Supabase (shared household)   | "הנתונים נשמרים בענן המשותף ומסונכרנים בין המכשירים." + `build <sha> · cloud`         |
| `demo`  | either variable is empty/absent                                    | this browser's `localStorage` | "מצב הדגמה — ללא סנכרון ענן" (target `demo`) / **blocked app** (target `shared`, §1a) |

Implementation: `src/lib/build-info.ts` (`getBuildInfo()`), rendered by
`src/components/nutrition/RuntimeModeNotice.tsx`. The page `<title>` says
"גרסת הדגמה" only in demo mode.

### 1a. The runtime target — fail-safe added 2026-09-18 (DEC-024)

Mode says where data _would_ live; the **target** says what the build was
_meant_ to be, so a missing configuration can no longer degrade silently:

| `VITE_RUNTIME_TARGET` | Meaning                                                        | Default                                               |
| --------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| `shared`              | the couple app — Supabase configuration is **required**        | **every production bundle** (`vite build`) when unset |
| `demo`                | a deliberate local/demo build — demo mode allowed and labelled | development bundles (`vite dev`) when unset           |

`misconfigured = target === "shared" && mode === "demo"`. A misconfigured build
is **blocked**: `src/components/nutrition/RuntimeGate.tsx` (mounted in
`src/routes/__root.tsx` _outside_ `AuthGate` and `StoreProvider`) renders a
full-screen `role="alert"` page with `data-runtime-mode="misconfigured"` and the
build id, and nothing else mounts — no store, no auth, no localStorage writes
(`persistence.saveState` additionally refuses to write in that state). The
console line is `console.error(... SHARED BUILD WITHOUT SUPABASE CONFIGURATION
(app blocked))`. The block page is server-rendered too, so even the raw HTML of a
misconfigured publish says so.

Consequences:

- A production publish with the two Supabase values missing (the 2026-09-18
  situation) now shows the block page instead of a usable demo app.
- A production publish that is _meant_ to be a demo must set
  `VITE_RUNTIME_TARGET=demo`; unknown values are ignored (treated as unset).
- `vite dev` / the hermetic Playwright tests keep working without any `.env`.

Tests: `src/lib/build-info.test.ts`, `src/components/nutrition/RuntimeGate.test.tsx`,
`src/lib/persistence.test.ts`, and the browser regression
`e2e/hermetic/misconfigured-shared.spec.ts` (dev server started with
`VITE_RUNTIME_TARGET=shared` and no Supabase env → block page in SSR HTML and in
the browser, empty localStorage, zero Supabase requests).

## 2. Build identity

`vite.config.ts` injects two public, non-secret values into every bundle:

- `VITE_BUILD_SHA` — resolution order: `process.env.VITE_BUILD_SHA` (supplied by
  the build environment) → `git rev-parse --short HEAD` → `"unknown"`.
- `VITE_BUILD_TIME` — ISO timestamp of the build.

They are observable in three places on the running app:

1. footer text `build <sha> · <mode>` (and `data-build-sha` on the notice element);
2. console on load: `[elenas-plate] build=<sha> builtAt=<time> mode=<mode> target=<target>`;
3. `window.__ELENAS_PLATE_BUILD__` (`{ sha, builtAt, mode, target, targetExplicit, productionBuild, misconfigured }`).

### 2a. `build-info.json` — the artifact-level manifest (2026-09-18)

Every `vite build` also emits **`/build-info.json`** next to the client assets
(`.output/public/build-info.json`, served at `<site>/build-info.json`) from the
`elenas-plate:build-info-manifest` plugin in `vite.config.ts`:

```json
{
  "sha": "8d28d6f",
  "builtAt": "2026-09-18T07:04:01.753Z",
  "mode": "cloud",
  "target": "shared",
  "targetExplicit": true,
  "supabaseHost": "rqgoiuztphkcvbwtbxbj.supabase.co",
  "productionBuild": true,
  "hermetic": false,
  "misconfigured": false
}
```

It contains the Supabase **host only** — never the key. It answers "which commit
is published and was it built connected, and to which project?" without a
browser or a sign-in. A site that returns no JSON there is a build from before
this manifest existed (every publish up to and including the one live on
2026-09-18).

Verified locally: `npm run build` on commit `2624a52` embeds `2624a52` in
`.output/public/assets/routes-*.js`; on `8d28d6f` the manifest above is emitted.

## 2b. Release preflight — `npm run preflight` (2026-09-18)

`scripts/release-preflight.ts` is the executable answer to "is this build safe
to publish as the shared app?" It is read-only, needs no secrets, and exits 1 on
any FAIL:

| Invocation                          | What it inspects                                                                                                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run preflight -- --env`        | the local `.env` before building: URL host = production ref, anon key present and **not** a `service_role`/`sb_secret_` key, `VITE_RUNTIME_TARGET` unset/`shared`, project reachable                       |
| `npm run preflight -- --local`      | `.output/public` after `vite build`: manifest present, sha = `HEAD`, mode `cloud`, target `shared`, `misconfigured=false`, compiled host = production, bundle contains the host, no secret-shaped strings  |
| `npm run preflight -- --live [url]` | the served site (default `https://my-elenas-plate.lovable.app`): HTTP 200 + `x-deployment-id`, HTML has no block/demo markers, `/build-info.json` present and sha = `origin/main`, bundle host, no secrets |

Options: `--expect-sha`, `--expect-ref`, `--allow-demo` (for a deliberate demo
publish), `--json`. The grants/ledger state of the database is listed as `MANUAL`
(needs the owner's Dashboard: `supabase/verify_privileges.sql`). Constants
(production ref, URL — all public) live in `scripts/release-config.ts`.

Run on 2026-09-18 against the live site: **FAIL** (`html:live` demo title,
`manifest` missing) — i.e. it detects the current defect.

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

**Status as of 2026-09-18 — VERIFIED FAILING (blocker, DEC-024).** The published
build at `https://my-elenas-plate.lovable.app` (Lovable project
`ca9aedab-a0ca-4889-a545-9d673febf3a0`, response header
`x-deployment-id: 0c0eb717b3ba11d94402ff682bf086c610054b78a1e9c14f04b324cfcaf7e375`,
assets `index-DDV3cWq7.js` / `routes-CwWPWhBt.js`) is a **pre-M1 build with no
Supabase configuration**: the compiled client module reads
`var Lg=``,Rg=``;function zg(){return!1}` — i.e. `VITE_SUPABASE_URL=""`,
`VITE_SUPABASE_ANON_KEY=""`, `isSupabaseConfigured()` ⇒ `false`. No
`*.supabase.co` project host appears anywhere in the served HTML or JS. The app
therefore runs in **demo mode on every phone** (localStorage only, nothing
shared). Its code corresponds to `main` client code ≥ `6768c99` (390-item
catalog present; no later `main` commit changed shipped client code); it has no
build SHA because it predates M1.

Read-only reproduction without a browser (no sign-in needed):

```sh
curl -sD - -o page.html https://my-elenas-plate.lovable.app/ | grep -i x-deployment-id
grep -o 'assets/[A-Za-z0-9_-]*\.js' page.html | sort -u        # asset names = build fingerprint
curl -s https://my-elenas-plate.lovable.app/assets/<index chunk>.js \
  | grep -o '[a-z]\{20\}\.supabase\.co'                         # must print the project host
```

To fix: in the Lovable project settings add `VITE_SUPABASE_URL=https://rqgoiuztphkcvbwtbxbj.supabase.co`
and `VITE_SUPABASE_ANON_KEY=<anon/publishable key>` (public values, never
`service_role`; leave `VITE_RUNTIME_TARGET` unset), then **publish** from `main` and run
`npm run preflight -- --live` — it must print `PREFLIGHT PASS`; the footer must read
`build <sha> · cloud` and `<site>/build-info.json` must show `"mode": "cloud"` with the
production host.

## 5. Local / test modes

- `npm run dev` — uses `.env` (currently points at production; treat as read-mostly).
- `npx vite dev --mode hermetic` / `npm run e2e:hermetic` — forces demo mode
  regardless of `.env*`; cannot contact any Supabase project. Used for the
  hermetic Playwright tests.
- `npm run e2e` (`--mode e2e`) — loads `.env.e2e`, which **must** point at the
  isolated hosted Supabase test branch (not production, not local Docker).
  Since 2026-09-16 it points at branch `m1-shared-truth-test`
  (`uyroeumwmjhrcbkesmgb`); the live Vitest suites use `SUPABASE_TEST_URL` /
  `SUPABASE_TEST_ANON_KEY` for the same branch.
- Migrations reach the branch with `supabase db push --db-url <branch session
pooler URL>`. The CLI link file (`supabase/.temp/project-ref`) points at
  production, so never run `db push` without `--db-url` for the branch.
- Table privileges: since `20260916120000_grant_table_privileges.sql` the
  migrations grant SELECT/INSERT/UPDATE/DELETE explicitly to `authenticated` and
  `service_role` (a fresh environment no longer grants them by default). `anon`
  deliberately has no data privileges; RLS remains the authorisation gate.
- Vitest — `src/test/setup.ts` blanks the Supabase env; cloud-path tests mock
  the client module and use `src/test/fake-supabase.ts`.
