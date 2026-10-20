<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## AdventureWorks web app

- Follow repository-root AGENTS.md and docs/sales-dashboard.md.
- This is one local sales dashboard, not a configurable BI platform. No deployment is authorized.
- Keep filesystem/data parsing and exact metric composition in lib/data.ts on the server; components consume typed view data. Project only the selected view's required props before the client boundary; do not serialize unrelated full row sets into HTML/RSC. Preserve all records required for interactive search/sort/pagination.
- The tracked data/demo.json is explicitly fictional and must remain available. Real source exports stay ignored under output/. The fixed data/adventureworks2022.json artifact has explicit repository-publication approval; replacement bytes need fresh review/approval. Production accepts only its pinned bytes, content hash and snapshot. AW_DASHBOARD_DATA works only outside production.
- Date and territory filter all views; category filters product/category views only. Make scope visible.
- Run npm run format:check, npm run typecheck, npm test, npm run build, npm run test:e2e. Run npm run evidence after tests. Default Playwright uses the fictional development server; AW_E2E_SAMPLE=1 runs the same suite against the production sample build and must never capture tracked screenshots.
- Screenshots committed to docs/screenshots must use the fictional fixture and show the demo disclosure. Never capture real data for public artifacts.
