# Issue #7 validation and review status

Local validation: October 19, 2026 (America/Los_Angeles). The starting main was
`7bb1204dcf1f1e669429b96eef940fff07b15974`. GitHub confirmed PRs #10, #11 and #12
merged before branch `codex/issue-7-sales-dashboard` was created. Issue #7 remains
open pending review and merge approval. The app has not been deployed.

Initial clean implementation validation used commit
`ed73f6c0a718c6de77579939a9e5a6325115e91c`: **22 Python tests, 15 frontend tests,
and six browser tests passed**, plus the four independent real-data HTTP scenarios.
Web, Python and real-data evidence all record `working_tree_dirty=false`. The
following commit updates this record and regenerates only fixture provenance;
the fictional logical content hash and input fingerprint remain unchanged.
The final browser rerun completed normally in 30.1 seconds. Fixture regeneration
again passed the full 23-model/97-test pipeline from that clean implementation.

## Data boundary and actual checks

- Built the fictional dashboard fixture through the existing snapshot and dbt
  pipeline: 576 source orders, 528 shipped orders, 23 models and 97 data tests.
  All models were independently reconciled from the fixture Parquet snapshot.
- Exported daily customer/product/category cells from the validated facts and
  dimensions. Reconciled all rows of all six existing marts, including exact AOV.
  `scripts/build_dashboard_fixture.py --check` reproduced the tracked logical
  content hash `06b51c1b98d7a08baa7acae946142718e5d1ef362199c890c69126573d2de380`.
- Python quality suite: **22 tests passed**, retaining the existing synthetic,
  extraction and dimensional regressions. The added test requires the named
  mart reconciliation error on deliberately changed exported amounts and rejects
  an artifact checksum mismatch without replacing the existing export.
- Vitest / React Testing Library: **15 tests passed**. Coverage includes contract
  and checksum rejection, duplicate cell and relationship rejection, exact sums,
  overlapping product order counts, inclusive day boundaries, combined filters,
  explicit category scope, null AOV, correct halfway rounding, component rendering,
  filter/reset requests, request errors, customer search and chart transformation.
- Production build and strict TypeScript passed. Formatting checks use the pinned
  formatter. No Python dependency changes were made.
- Playwright: **six tests passed (24.4 seconds)** with normal process exit and
  reports. Desktop and Pixel 7 Chromium emulation exercised overview, filters, category
  scope, reset/search, keyboard entry, chart tables, empty results and invalid API
  filters. Axe WCAG A/AA checks were included; see the final machine-readable
  browser report for the completed run and counts. Screenshots in `screenshots/`
  contain only the fictional demo and were visually inspected.

Initial browser checks exposed low-contrast secondary text, ambiguous select
labels, a damaged Unicode label, controls usable before hydration, and mobile
scrollable tables without keyboard focus. These were corrected. The test's
native disclosure selector was also corrected. On this Windows sandbox,
Playwright could run all tests but could not finish terminating its owned server;
the final run used process permissions to complete normal shutdown and reports.
No checks were weakened or skipped to obtain passing results.

## Real-source local validation

The existing AdventureWorks snapshot was available; no SQL Server connection,
source change, container operation, restore or fresh extraction was needed.

- Snapshot identity: `20261019T001836Z-ee2547d8e90749b68133c76a806f9e6f`.
- Input fingerprint:
  `97213a5b66b6cacb8229182a65442bf8bf66c6eb9430120f01afedb8ac5cfe89`.
- Actual source reporting period: **2011-05-31 through 2014-06-30**.
- The exporter verified current analytical database/evidence hashes, original
  snapshot integrity, independent reconstruction of all 23 models, model hashes
  against the published evidence, and all six mart export controls.
- A local production Next server consumed that real export. Four HTTP scenarios
  were independently compared with fresh DuckDB SQL: full data; 2012 with
  territory/category 1; the single boundary day 2011-05-31; and an empty 2030 day.
  Every returned overview/month/customer/territory/product/category row and exact
  AOV matched. No real-derived dataset or screenshot was tracked or uploaded.

Local evidence is ignored under `output/dashboard/data.json`,
`output/dashboard/http-validation.json`, `output/issue7-real-export.log` and
`output/issue7-real-http.log`. The full-period totals matched the existing
validated analytical controls. These are local real-source checks, not CI claims.

## Evidence and environment

Web evidence: `apps/web/test-results/evidence.json`, `vitest.json`,
`playwright.json`, browser HTML report and retained failed traces. The evidence
script records revision/dirty state, local versus CI context, Node/dependency
versions, npm lock hash, fixture fingerprints and actual test counts. Initial
local runs record the base revision and modified working tree, not validation of
unchanged main; inspect the final evidence's actual revision/state.

Python evidence: `output/quality/tests.json`, fixture analytical evidence, and
`output/issue7-quality.log`. Fixture reproduction records remain under
`output/dashboard-fixture/`. Run IDs and revision metadata can differ while
logical content is identical.

Local environment: Windows, Node 22.23.2, npm 12.0.2, Python 3.13.15,
DuckDB 1.5.6, dbt Core 1.12.5, dbt-duckdb 1.11.0, PyArrow 26.0.0.
Web dependencies are pinned in `apps/web/package-lock.json`; their actual
versions are also recorded by `npm run evidence`. Installation reported zero
known npm vulnerabilities at that time; this is not a lasting security guarantee.

The web PR workflow installs from the lock, checks formatting/types/unit tests,
builds the actual app, runs desktop/mobile Chromium workflows and axe checks,
then uploads its reports with revision provenance. The original Python workflow
is preserved and additionally verifies fictional fixture reproduction. Both
workflows require neither private data nor SQL Server; package/browser downloads
are dependency setup. Remote CI results belong to the PR and are separate from
these local results.

## Limits

See [architecture, exact filters and recovery/reproduction](sales-dashboard.md).
Category selection applies only to product/category views; header allocation is
unsupported. Metrics use source monetary units without currency conversion or
recognized-revenue claims. These are historical shipped-order metrics with
snapshot-current dimensions and no retention/lifetime-value inference.

No fresh-machine SQL Server reproduction, physical mobile device, Firefox/Safari,
manual screen-reader audit, large-scale serving benchmark, public hosting,
authentication/persistence or production readiness validation was performed.
Axe checks do not establish complete accessibility compliance. Real dataset
redistribution provenance and the repository-wide code license remain unresolved.


## PR #13 visual acceptance refinement

The subsequent visual refinement splits analytics into six App Router pages:
`/`, `/trends`, `/products`, `/customers`, `/territories`, `/definitions`.
Branding and typography were revised; the redundant breadcrumb, workspace label,
overview eyebrow and footer branding were removed. Definitions now owns the
full metric contract and provenance. All analytics pages share disclosure and
filters above their content.

Applied filters are URL state; controls keep drafts until Apply. Shared Next Link
navigation preserves queries, Reset removes them, and back/forward restores each
selection. Invalid values, duplicate keys and unknown keys fail closed without
metrics. Pending filter transitions hide analytical values. Category affects
only products/categories, including no category-sensitive overview counts.

Customer orders, sales, contribution and validated header AOV use independent
min/max scales over every date/territory-filtered customer, before search or
pagination. Exact decimal values remain alongside the display amounts. Empty,
identical positive, zero and unavailable comparisons have explicit behavior.

Currency decision remains pending manual acceptance: the source contract does
not independently establish USD. The issue was flagged before changing the
label. Zero-decimal en-US formatting is implemented with exact post-aggregation
rounding, while source-unit labeling is retained. No conversion or verified USD
claim is introduced. Using a USD display assumption requires an explicit decision.

Executed refinement checks on the modified branch based on `39d6b95`:

- 22 Python quality/regression tests passed (`output/issue13-quality.log`).
- Fictional fixture content reproduced unchanged through the 23-model/97-test
  pipeline (`output/issue13-fixture.log`).
- 15 frontend unit/component tests passed; original data-contract tests remain.
- TypeScript and production build passed with all six dynamic pages.
- Six Chromium desktop/Pixel 7 browser tests passed, including all-page axe checks,
  navigation/active states, filter history/drafts/reset/category scope, invalid URLs,
  empty selection, exact chart alternatives and keyboard table access.
- Desktop/mobile fictional overview and customer screenshots were regenerated
  and visually inspected. They contain no real-derived records.

Local evidence reports the actual base revision and modified working tree; it
must not be described as clean-head validation. The analytical exporter and API
contract are unchanged. Earlier real-source checks above remain historical
validation, not a claim of a new full-source or HTTP rerun for this refinement.
PR #13 stays draft; visual acceptance, currency decision and merge approval
remain with the user. Issue #7 is not complete and nothing has been deployed.
