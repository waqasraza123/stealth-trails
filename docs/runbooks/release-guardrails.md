# Release Guardrails

This repo now uses layered release guardrails:

- local pushes are blocked by `.githooks/pre-push`
- pull requests are gated by `.github/workflows/required-pr-gate.yml`
- `main` runs the heavy verification workflow plus production API smoke

## Local guardrails

`pnpm install` runs `prepare`, which configures `core.hooksPath=.githooks`.

If hooks stop firing:

```bash
pnpm setup:hooks
pnpm hooks:check
```

The canonical local gate is:

```bash
pnpm verify:push
```

That gate now includes:

- push wrapper tests
- monorepo build
- compiled API bootstrap smoke
- lint
- unit tests
- integration tests
- coverage
- Playwright critical flows
- mobile verification

## API smoke coverage

The smoke script lives at `scripts/api-smoke.mjs`.

It verifies:

- `GET /healthz`
- `GET /readyz`
- `OPTIONS /auth/login` with an allowed origin

Local smoke uses the compiled `apps/api/dist/main.js` default export behind a tiny Node HTTP server, so it checks the Vercel handler contract directly.

## GitHub and Vercel setup

The PR and deployment workflows require these GitHub Actions secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_API_PROJECT_ID`
- `STEALTH_TRAILS_BANK_API_VERCEL_BYPASS_SECRET`
  optional, but required if the API project uses Vercel deployment protection

`required-pr-gate` resolves the preview deployment URL for the PR commit and runs deployed smoke against it when API-relevant files changed.

`production-api-smoke` waits for the production deployment for the merged commit, then smokes `https://api.stealth-trails.space` with the canonical customer origin `https://www.stealth-trails.space`.

## Branch protection

Protect `main` with:

- require pull requests before merging
- require the `required-pr-gate` status check
- block force pushes

If branch protection is configured before the new check has ever run, GitHub may not offer it as a selectable required status yet. Run the workflow once on a pull request, then finalize the required-check selection.
