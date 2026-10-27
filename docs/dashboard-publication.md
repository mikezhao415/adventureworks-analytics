# Dashboard publication runbook — Issues #8 and #16

The published dashboard is [adventureworks.mikezhao.dev](https://adventureworks.mikezhao.dev). PR #17 merged as `b56b49a18df9c12c4d61c344894fcf0395d20e3a` and the approved aggregate replaced the earlier fixture deployment. The [case study](https://mikezhao.dev/projects/adventureworks-analytics), [business narrative](https://mikezhao.dev/projects/adventureworks-analytics/business), and [technical implementation](https://mikezhao.dev/projects/adventureworks-analytics/technical) are also published. There is no hosted source database or live ingestion. See [exact artifact review](dashboard-artifact-review.md) and [redistribution policy](data-redistribution.md).

Production reads only `apps/web/data/adventureworks2022.json`, with code-reviewed file size, full-file SHA-256, canonical data hash, sample provenance and snapshot pins. It ignores `AW_DASHBOARD_DATA`; missing/unexpected files fail closed. The exact candidate received explicit repository-publication approval on October 20, 2026; replacement bytes require fresh approval. The subsequent approved Production release is recorded in the artifact review; future deployment approval remains separate. The Next.js API trace includes the fixed file and Microsoft notice; the raw JSON is outside `public/`. Development defaults to unchanged `data/demo.json` and permits local overrides.

## Local verification

Use Node 22 and `npm ci`, `npm run format:check`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, and `npm run evidence` in `apps/web`. There is no configured lint script; formatting and TypeScript are the configured static checks. Default E2E uses the fictional development server and requires no source dataset. With the exact local candidate present, run the same suite using `AW_E2E_SAMPLE=1` against the production server. The invalid override must be ignored. Run evidence for each mode, preserving reports locally before the next run. Never run a build while a server uses that `.next` output.

Inspect the API trace and total traced bytes, data file hashes, license notice, full API response sizes, load/validation/composition timing and memory. Run `scripts/check_dashboard_api.py` against the candidate to compare six HTTP scenarios with independent local SQL controls. No downsampling/truncation is authorized. Local results do not establish Vercel performance or concurrency.

## Historical Issue #16 approval and release sequence

The sequence below records the original release process, not pending instructions for the completed PR #17. Its original Vercel URL, deployment ID, owner-reported checks and local measurements remain in the artifact review. Use the [reproducibility guide](reproducibility.md) for current local commands. New artifacts and releases require fresh approval.

1. Exact candidate contents/redistribution were approved October 20, 2026 under the documented conditional assessment. Stage only the 32 paths in `docs/issue-16-staging.txt`; verify the exact staged bytes/hash. Do not stage output/ or unrelated data.
2. Prepare a draft PR after artifact approval; retain fixture rollback and run all CI checks. Update parent #8 scope after approval without closing its case-study work.
3. The user authorized pushing `feature/16-adventureworks-dashboard-publication` for a draft PR, after checking Git deployment behavior. Obtain separate explicit merge approval. No preview or production deployment is authorized by that push approval.
4. Obtain separate approval for any preview or production deployment. Do not alter current production or environment variables. Verify the protected deployment's source mode, hashes/identity, attribution, filters, mobile/keyboard/axe behavior and runtime limits before public promotion.
5. Close #16/#8 only with their respective evidence and approval.

## Rollback

Retain the historical fictional deployment reference and its matching revision. With explicit approval, restore that deployment/build, including its fixture loader; copying demo.json into the new pinned path correctly fails. The current source fixture remains unchanged. New sample exports require a fresh artifact review and pins, not a runtime environment switch. Original project code licensing remains a separate decision.


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

For the historical exact-candidate content audit, run `node scripts/review-artifact.mjs` in `apps/web` only when the original matching `output/dashboard/data.json` is also available. The script compares those bytes before auditing; it is not a clean-checkout test or a check for a newly regenerated export. For HTML/RSC measurements, use `node scripts/measure-page-payloads.mjs before` on the prior build and `after` on the new build, with the same exact artifact and loopback port. Neither command publishes data. The pinned JSON has a path-specific Git `-text` attribute; preserve it when preparing an explicitly approved release.
