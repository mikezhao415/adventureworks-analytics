# Dashboard publication runbook — Issues #8 and #16

The existing fixture deployment remains unchanged. This branch prepares a static Microsoft AdventureWorks 2022-derived aggregate release; no runtime database or live ingestion is proposed. See [exact artifact review](dashboard-artifact-review.md) and [redistribution policy](data-redistribution.md).

Production reads only `apps/web/data/adventureworks2022.json`, with code-reviewed file size, full-file SHA-256, canonical data hash, sample provenance and snapshot pins. It ignores `AW_DASHBOARD_DATA`; missing/unexpected files fail closed. The exact candidate received explicit repository-publication approval on October 20, 2026; replacement bytes require fresh approval. Deployment approval remains separate. The Next.js API trace includes the fixed file and Microsoft notice; the raw JSON is outside `public/`. Development defaults to unchanged `data/demo.json` and permits local overrides.

## Local verification

Use Node 22 and `npm ci`, `npm run format:check`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, and `npm run evidence` in `apps/web`. There is no configured lint script; formatting and TypeScript are the configured static checks. Default E2E uses the fictional development server and requires no source dataset. With the exact local candidate present, run the same suite using `AW_E2E_SAMPLE=1` against the production server. The invalid override must be ignored. Run evidence for each mode, preserving reports locally before the next run. Never run a build while a server uses that `.next` output.

Inspect the API trace and total traced bytes, data file hashes, license notice, full API response sizes, load/validation/composition timing and memory. Run `scripts/check_dashboard_api.py` against the candidate to compare six HTTP scenarios with independent local SQL controls. No downsampling/truncation is authorized. Local results do not establish Vercel performance or concurrency.

## Approval and release sequence

1. Exact candidate contents/redistribution were approved October 20, 2026 under the documented conditional assessment. Stage only the 32 paths in `docs/issue-16-staging.txt`; verify the exact staged bytes/hash. Do not stage output/ or unrelated data.
2. Prepare a draft PR after artifact approval; retain fixture rollback and run all CI checks. Update parent #8 scope after approval without closing its case-study work.
3. The user authorized pushing `feature/16-adventureworks-dashboard-publication` for a draft PR, after checking Git deployment behavior. Obtain separate explicit merge approval. No preview or production deployment is authorized by that push approval.
4. Obtain separate approval for any preview or production deployment. Do not alter current production or environment variables. Verify the protected deployment's source mode, hashes/identity, attribution, filters, mobile/keyboard/axe behavior and runtime limits before public promotion.
5. Close #16/#8 only with their respective evidence and approval.

## Rollback

Retain the current fictional deployment and its matching revision. With explicit approval, restore that deployment/build, including its fixture loader; copying demo.json into the new pinned path correctly fails. The current source fixture remains unchanged. New sample exports require a fresh artifact review and pins, not a runtime environment switch. Original project code licensing remains a separate decision.


## Windows controlled-server verification

If managed-server teardown hangs in a restricted Windows session, create ignored `test-results/external.config.ts` in `apps/web`:

```ts
import config from "../playwright.config";
import path from "node:path";
export default {
  ...config,
  testDir: path.resolve("e2e"),
  outputDir: path.resolve("test-results/playwright-artifacts"),
  webServer: undefined,
};
```

Run a loopback server in one terminal: `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100` for the sample production build (set `AW_DASHBOARD_DATA` to a nonexistent path to exercise isolation), or `next dev` through `npm run dev -- --port 3100` with no override for the fictional fixture. In another terminal, set `AW_E2E_SAMPLE=1` only for the sample run, then run `npx playwright test --config test-results/external.config.ts` and `npm run evidence`. Clear that flag for the fixture run. Stop the server before switching modes and keep source files stable during each development-server run. Preserve each mode's reports before the next suite.

Reporter paths are absolute so extending a config cannot redirect output to a nested directory. Evidence must show matching requested/reported data mode and the current report's test counts/timestamp. Untagged or mismatched reports are incomplete. Do not use stale successful reports as current validation. Keep this temporary configuration and all generated reports ignored.

For the final content audit, run `node scripts/review-artifact.mjs` in `apps/web`. For HTML/RSC measurements, use `node scripts/measure-page-payloads.mjs before` on the prior build and `after` on the new build, with the same exact artifact and loopback port. Neither command publishes data. The pinned JSON has a path-specific Git `-text` attribute; preserve it when preparing an explicitly approved release.
