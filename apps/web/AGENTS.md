<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## AdventureWorks web app

- Follow repository-root AGENTS.md and docs/sales-dashboard.md.
- This is one local sales dashboard, not a configurable BI platform. No deployment is authorized.
- Keep filesystem/data parsing and exact metric composition in lib/data.ts on the server; components consume typed view data.
- The tracked data/demo.json is explicitly fictional. Real source exports must remain ignored under repository output/ and selected by AW_DASHBOARD_DATA.
- Date and territory filter all views; category filters product/category views only. Make scope visible.
- Run npm run format:check, npm run typecheck, npm test, npm run build, npm run test:e2e. Run npm run evidence after tests.
- Screenshots committed to docs/screenshots must use the fictional fixture and show the demo disclosure. Never capture real data for public artifacts.
