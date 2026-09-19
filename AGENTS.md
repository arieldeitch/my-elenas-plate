<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Development environment invariant — no local Docker by default

Ariel's workstation must remain lightweight. Do **not** start Docker Desktop,
`supabase start`, a local self-hosted Supabase stack, Testcontainers, or any
other container workload on Ariel's computer as part of the normal workflow.

Use this order instead:

1. Hermetic Vitest/unit/component tests locally — no backend required.
2. Playwright/browser tests against the normal Vite app — no containers.
3. Supabase integration/RLS/Realtime tests against an **isolated hosted Supabase
   development branch or dedicated non-production test project** using
   `SUPABASE_TEST_URL` / publishable-or-anon test credentials.
4. Create migration files explicitly in Git and validate them on the hosted test
   environment before production. Prefer commands and connected Supabase tools
   that operate remotely and do not start a local database.

Local Docker is an exception, not a prerequisite. It may be used only when an
acceptance criterion genuinely cannot be proven against the hosted isolated
environment or with hermetic tests, and only after documenting the reason and
getting Ariel's explicit approval. If container execution is unavoidable,
prefer CI/cloud execution over Ariel's workstation.

See `docs/NO_LOCAL_DOCKER_POLICY.md` for the full decision and test strategy.

## OS alignment (Control Tower)

At the start of every substantial run read the canonical Ariel AI Operating System and record an OS Access Receipt as described in `OS_ALIGNMENT_RECEIPT.md` (project P-005 on PROJECT_CONTROL_BOARD). Control Tower is the evidence owner; commits and pushes are not alignment evidence.
