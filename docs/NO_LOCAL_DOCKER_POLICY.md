# No-Local-Docker Development Policy

**Status:** Accepted for the recovery program
**Date:** 2026-09-15
**Owner constraint:** Ariel's workstation must not run Docker as part of the normal development/test loop because the local Supabase container stack causes unacceptable resource contention.

## Decision

The nutrition application does **not** depend on Docker at runtime, and the development architecture must not depend on Docker on Ariel's workstation either.

Local Docker is therefore **opt-in emergency tooling only**.

The default architecture is:

- frontend development: local Vite/Node only;
- deterministic logic/component tests: local Vitest only;
- browser UX/E2E tests: local or hosted browser against the Vite/Lovable build, without containers;
- Supabase Auth/RLS/Realtime/database integration tests: an **isolated hosted Supabase development branch** (preferred) or dedicated non-production Supabase test project;
- production: managed Supabase project `rqgoiuztphkcvbwtbxbj` + Lovable/manual publish path.

Do not run `supabase start`, local `supabase db reset`, Docker Desktop, Testcontainers, or a self-hosted Supabase stack on Ariel's workstation in the normal workflow.

## Verified reasons this is viable

1. `package.json` contains no Docker-based runtime or test command. App dev/build/test is Vite + Vitest + Playwright.
2. The live Supabase integration suites already accept `SUPABASE_TEST_URL` and `SUPABASE_TEST_ANON_KEY` and explicitly support a **remote or local** Supabase target.
3. The production Supabase organization is on the **Pro** plan and the project supports Supabase development branches. No development branch exists yet.
4. Supabase development branches provide isolated Database/API/Auth/Storage environments without production data, which is exactly what the mutation/RLS/Realtime tests need.
5. The project currently has no application Edge Functions or Storage buckets, so running the entire local Supabase stack is especially wasteful for normal work.

## Important migration-history caveat

Production migration history currently records migrations through `20260723090400`, while the repository also contains `20260725190000_cleanup_mock_data_and_seed_food_catalog.sql` whose production effects were applied through the historical bootstrap/seed process rather than recorded as a normal migration.

Therefore the first hosted test branch is also a **reproducibility check**:

- do not assume its data/catalog matches production;
- do not copy production data into it;
- automated M1 correctness tests should create their own isolated test users/households/rows;
- if UI catalog tests require the catalog, seed the branch with a deterministic **test-only** fixture or the repository's safe catalog generator after the test household exists;
- do not rerun the historical production bootstrap as a shortcut.

This caveat is not a reason to return to local Docker.

## Test pyramid

### Tier 1 — Hermetic tests (always first, no network)

Run locally:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- targeted Vitest suites

Mock/stub only transport boundaries. Keep mutation ordering, queue semantics, conflict handling, and mapping logic deterministic and testable without Supabase.

### Tier 2 — Browser behavior (no Docker)

Run Playwright against the normal app/dev server for:

- device-default profile behavior;
- offline queue survival across reload;
- cloud/demo mode labeling;
- interaction and rendering regressions.

When a test needs a real backend, point the app at the hosted Supabase test branch.

### Tier 3 — Hosted Supabase integration (real Auth/RLS/Realtime)

Use branch-specific environment variables such as:

- `SUPABASE_TEST_URL`
- `SUPABASE_TEST_ANON_KEY` or publishable key
- `SUPABASE_TEST_EMAIL_DOMAIN` when needed

Run the existing `rls.integration.test.ts` and `remote-live.integration.test.ts` plus M1 concurrency tests there.

Test accounts and rows may be created freely inside the disposable branch because it is isolated from production. Never point these suites at production.

### Tier 4 — Production verification

Production verification is read-only by default. Use production writes only for deliberate real-user acceptance testing, never for automated integration tests.

## Database migration workflow without local Docker

Prefer explicit SQL migrations over local schema-diff workflows.

1. Create a migration file in `supabase/migrations` (the CLI `migration new` command is acceptable because it only creates a local file and does not start Docker).
2. Write/review the SQL explicitly.
3. Apply the migration to the isolated hosted Supabase branch using remote Supabase tooling / remote `db push`.
4. Run integration suites and Supabase security/performance advisors on the branch.
5. Review the migration diff in Git.
6. Only after approval, apply the migration to production through the controlled release path.

Avoid `supabase db pull`, `supabase db diff`, local `db reset`, or any workflow that silently starts a shadow/local database when that would require a container runtime on Ariel's workstation.

If a future change truly requires generated schema diffing, run that operation in CI/cloud or another isolated machine rather than on Ariel's primary workstation.

## Exception policy

Docker may be used only if **all** of the following are true:

1. a required acceptance criterion cannot be reliably proven with hermetic tests + hosted Supabase branch;
2. the reason is documented before starting Docker;
3. no lighter remote/CI alternative is available;
4. Ariel explicitly approves the exception;
5. if practical, container execution happens in CI/cloud rather than on Ariel's workstation.

"Supabase docs recommend local development" is not, by itself, sufficient justification for an exception.

## M1 implication

For `recovery/m1-shared-truth`, Claude must not start local Supabase/Docker. It should implement and run all hermetic/browser tests first. Real Auth/RLS/Realtime/concurrency tests are run against a hosted isolated Supabase branch once that branch is provisioned. If the branch is not yet available, Claude should report the live-integration gate as pending rather than fall back to local Docker.

## Enforcement and workstation checklist (added 2026-09-18)

Docker Desktop started on Ariel's primary workstation during the 2026-09-16 Claude run even though
the run itself used no container. The 2026-09-18 run executed on a second computer where Docker is not
installed, so the trigger could not be reproduced there; the audit below is what was verified in the
repository and what remains to be checked on the primary workstation.

### What the repository does and does not do (verified)

- No `package.json` script, Playwright config, Vitest config, or test file starts Docker or
  `supabase start`. The Playwright configs start only `vite dev`.
- `supabase/config.toml` is the Supabase CLI project config. Its presence is harmless; it is used by
  `db push --db-url`, `migration new` and `migration list`, none of which start Docker.
- The **only** repository text that told a session to start the local stack was
  `docs/claude-context.md` ("run them against a local stack (`npx supabase start`)"), written on
  2026-08-01 before this policy. It was rewritten on 2026-09-18 to point at the hosted branch.
- `.claude/settings.json` (committed, 2026-09-18) now **denies** Claude Code from running the commands
  that would start a container runtime from this repo: `docker …`, `docker-compose …`, `podman …`,
  `supabase start`, `supabase db reset|diff|dump|lint|start`, `supabase test …`,
  `supabase functions serve` (also via `npx`/`bunx`, in both the Bash and PowerShell tools). Deny rules
  apply in every permission mode. Remove an entry deliberately, with a documented exception, if a
  container is ever genuinely required.

### Supabase CLI commands that require Docker (never run them here)

`supabase start`, `supabase stop`, `supabase status`, `supabase db start`, `supabase db reset`,
`supabase db diff`, `supabase db dump`, `supabase db lint`, `supabase test db`,
`supabase functions serve`, `supabase gen types --local`. Everything the workflow needs —
`supabase migration new`, `supabase migration list`, `supabase migration repair`,
`supabase db push [--db-url …] [--dry-run]`, `supabase link`, `supabase branches …` — talks to the
hosted project directly and starts nothing locally.

### Checklist for the primary workstation (Ariel; nothing here can be changed from the repo)

Work through these in order and stop at the first one that explains the auto-start:

1. **Docker Desktop → Settings → General:** untick **"Start Docker Desktop when you sign in to your
   computer"** (Docker registers itself under `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` as
   `Docker Desktop`; `Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'` shows it).
   If Claude sessions usually start right after sign-in, this alone matches the symptom.
2. **Claude Code MCP servers:** `claude mcp list` and search `~/.claude.json` for `docker` — a
   stdio MCP server configured as `docker run …` or `docker mcp gateway run` (Docker Desktop's "MCP
   Toolkit" writes exactly this into Claude clients) is spawned every time Claude Code starts.
   Remove it or switch it to a non-Docker transport.
3. **Claude Code hooks:** `~/.claude/settings.json` → `hooks.SessionStart` / `hooks.Setup` — any command
   there runs at session start.
4. **VS Code:** the Docker / Dev Containers extensions can start Docker Desktop when a workspace opens
   ("Dev Containers: Reopen in Container" prompts, or `docker.startDaemon`-style settings). This repo
   has no `.devcontainer/`, so only a user-level setting could do it.
5. **WSL:** `wsl -l -v`; Docker Desktop's WSL integration starts the `docker-desktop` distro when WSL
   is used by another tool. Disabling "Start Docker Desktop when you sign in" (1) also stops this.

Do **not** uninstall Docker Desktop for this project's sake; it is not needed by the Nutrition App
workflow and is left available for explicit manual use elsewhere.
