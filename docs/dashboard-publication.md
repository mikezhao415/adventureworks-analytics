# Dashboard publication runbook (Issue #8)

## Boundary

The public Next.js dashboard is a standalone fictional-data demonstration, not a hosted AdventureWorks analytics database or a live feed. The source repository includes a full local analytics pipeline; that pipeline is **not** a deployment dependency.

Production `loadDocument()` ignores `AW_DASHBOARD_DATA` and loads only `apps/web/data/demo.json`. It validates the document checksum and requires provenance mode `offline_fixture`. Next.js output file tracing explicitly includes the JSON fixture for the API route.

## Proposed Vercel configuration (not deployed)

- Account: personal Vercel account, separate project `adventureworks-analytics`
- Git repository: `mikezhao415/adventureworks-analytics`
- Framework: Next.js
- Root directory: `apps/web`
- Node.js: 24.x
- Install: `npm ci`; build: `npm run build`
- No database, Python, DuckDB, dbt, or source-export environment variables
- Keep previews protected. Do not enable public production without explicit approval.

**Caution:** Connecting Git can initiate automatic deployments. Review Vercel Git/deployment settings before importing the repository; this document does not authorize deployment.

## Local verification

From `apps/web` with Node 24.x:

```sh
npm ci
npm run format:check
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

In a production-mode server, verify `/api/dashboard` returns provenance mode `offline_fixture` and the disclosure reads "Fictional demonstration data". Check that an invalid `AW_DASHBOARD_DATA` override does not redirect production to another file. Test filter inputs, error responses, mobile and desktop views, keyboard navigation, accessibility, and deployment artifact boundaries.

Never publish `.bak`, real-source Parquet, DuckDB, credentials, or derived real-source exports. See [redistribution policy](data-redistribution.md). A passing local build does not by itself establish hosted runtime correctness.

## Approval gates

1. Review and approve this hardening PR before merging.
2. Separately approve any protected Vercel preview/project setup.
3. Separately approve public production release.
4. Separately approve closing Issue #8 after case-study and reproduction checks.
