# Sales analytics dashboard

Issue #7 adds a local Next.js App Router application in `apps/web`. It uses React,
TypeScript, Tailwind CSS and Recharts. Native labeled controls and small typed
components serve this dashboard without a component framework or dashboard engine.
No hosting, authentication, persistence, arbitrary uploads/SQL, scheduled refresh,
custom metrics or multi-tenancy are implemented.

![Fictional dashboard, desktop](screenshots/sales-dashboard-desktop.png)

## Start from a clean checkout

Use Node.js 22 (tested local version recorded in the validation report):

```powershell
cd apps/web
npm ci
npm run dev
```

Open the printed loopback URL. The checked-in `data/demo.json` is **fictional**:
576 deterministic orders over January 2013–December 2014, including canceled
orders that are excluded from the reported metrics. It was generated through
read-only-provider snapshot extraction, the actual 23-model/97-test dbt build,
independent Python reconciliation, and the dashboard export. It contains no
AdventureWorks source records or real-derived dataset. The browser identifies
demo mode throughout; these are not historical AdventureWorks business results.
No Python, SQL Server, Docker, credentials or external runtime service is needed
to launch the demo. Package and Playwright browser installation requires downloads.
The app loads no web fonts, external imagery, analytics or third-party data feeds.

For a production build **locally**:

```powershell
npm run build
npm run start
```

Both scripts bind to `127.0.0.1`. This issue does not deploy the application.
Do not run a build while a test or production server is using that same `.next`
output; stop that owned process first. The dev server uses `.next/dev`.

## Architecture and data boundary

```text
Validated immutable DuckDB run + evidence + original Parquet snapshot
  -> Python revalidates provenance, hashes and all 23 models independently
  -> daily filter-safe cells, reconciled against every row of all six marts
  -> version 1 JSON export (exact decimal strings, dimensions, provenance, hash)
  -> Next server: schema/hash/grain/FK checks, validated filters, exact composition
  -> typed response -> KPI/chart/table components
```

Presentation components live in `components/`, metric labels/formatting in
`lib/format.ts`, and AdventureWorks-specific access/composition in `lib/data.ts`.
Node filesystem access remains on the server. The client receives only shaped
responses, not the raw daily export. There is no runtime DuckDB or Python process
inside Next.js, and no source database connection. The JSON input is configured
on the server; components contain no machine-specific paths. The server and
`/api/dashboard` use the same typed data-access function. A configured missing or
invalid real export produces an error; it never silently falls back to demo data.

The existing marts each have one reporting grain and cannot be joined together
to obtain arbitrary date/territory/category combinations. The exporter therefore
uses the **already validated facts and dimensions** to produce three explicit
disjoint cell sets, then regroups and reconciles them to the six existing marts:

| Cell set | Grain / key | Measures |
| --- | --- | --- |
| Customer | Calendar date + order territory + customer | Orders, units, line sales, header subtotal/tax/freight/total due |
| Product | Calendar date + order territory + product | Distinct orders within product, units, line sales |
| Category | Calendar date + order territory + category | Distinct orders within category, units, line sales |

Headers and lines are aggregated separately before a one-to-one customer-cell
join. Orders belong to exactly one date/territory/customer cell. Thus date and
territory selections sum disjoint cells without header fan-out. Product/category
counts are computed separately with distinct order IDs: counts across products
or categories overlap and must never be added together. AOV is recomputed from
summed header subtotal and order count, never averaged from cell-level ratios.

All amounts cross JSON as decimal strings. The server sums scaled integers using
BigInt and rounds AOV half away from zero at four decimals, matching the existing
metric contract. UI headlines and ranked sales/AOV amounts round to zero decimals with en-US grouping;
exact source scales remain in chart alternatives, KPI descriptions and detailed
amount cells. USD presentation follows the reviewed [currency interpretation](currency-interpretation.md):
native AdventureWorks sample amounts, with no currency conversion applied.
SQL Server rate relationships and matching native prices support the interpretation;
Microsoft's OLTP schema does not explicitly label every monetary column USD.
Only chart coordinates/bar lengths use approximate JavaScript
numbers. Customer contribution is the customer's net line sales divided by the
selected all-category line-sales total, rounded to two percentage decimals.

## Pages and navigation

The shared responsive layout uses Next Link navigation with the active page
identified by `aria-current`. The disclosure and filters precede the page heading
on each analytics route. Definitions retains navigation and provenance without
interactive filters or duplicated methodology on the other pages.

| Route | Page |
| --- | --- |
| `/` | Sales overview |
| `/trends` | Sales trends |
| `/products` | Product/category performance |
| `/customers` | Customer insights |
| `/territories` | Territory performance |
| `/definitions` | Metric definitions and data provenance |

![Fictional customer comparisons, desktop](screenshots/sales-dashboard-customers-desktop.png)
![Fictional dashboard, mobile](screenshots/sales-dashboard-mobile.png)

## Questions and supported interactions

| View | Business question / measures | Date range | Order territory | Product category |
| --- | --- | --- | --- | --- |
| Executive overview | How much shipped line sales, how many orders/units, what header AOV? | Yes | Yes | Explicitly not applied |
| Monthly trend | When did selected sales and order activity occur? | Yes | Yes | Explicitly not applied |
| Products/categories | Which products and categories drive selected line sales and units? | Yes | Yes | Yes |
| Customers | Which customer IDs contribute sales, and how often did they order in this period? | Yes | Yes | Explicitly not applied |
| Territories | How do order territories compare on sales, orders and header AOV? | Yes | Yes | Explicitly not applied |

Date boundaries include both full selected calendar days, with no timezone
conversion. Partial months are grouped into their calendar month; the trend
contains months **with matching shipped orders**, without inventing a complete
zero-filled calendar. The active selection and actual source period are shown
separately. Unknown territory and Uncategorized members preserve nullable source
relationships. Invalid non-null keys are rejected upstream. Product and category
filters use the snapshot's current taxonomy, not historical category changes.

Category selection is labeled **product views** in the filter bar, repeated in
the active-filter chip and explained beside the controls. It does not filter
header metrics or customer/territory views: the source contract does not allocate
header money to categories. This avoids ambiguous category AOV and order counts.
Apply commits a selection; Reset restores the input's full period/all dimensions.
Applied selections use URL search parameters as their source of truth. Draft
controls remain local until Apply navigates to the filtered server-rendered page.
Shared Next Link navigation preserves the query; browser back/forward restores
the URL selection. Reset removes the query and restores full-period defaults.
Controls wait for hydration. Pending filter transitions hide analytics; invalid
URLs show an error without default or stale metrics. Invalid inputs can be fixed
with the controls or Reset. Empty
selections show zero orders/units/sales and NULL AOV (shown as an em dash).

Charts have tooltips and expandable exact tables. Customer IDs can be searched,
ranked by sales/orders/AOV/ID and paginated. Four customer bar columns use
independent minimum-to-maximum scales over the complete date/territory-filtered
customer dataset, before search or pagination. They are relative comparisons,
not shares of a total. Identical positive values fill the bar; zero stays empty
and unavailable AOV has no value. Exact amounts remain alongside the bars. Rankings are by selected-period sales,
not retention or lifetime value. Responsive navigation, native controls, skip
link, visible focus and chart tables support keyboard access. Automated axe
checks complement browser checks but do not establish complete accessibility
compliance or screen-reader coverage.

## Local real-source use and refresh

Real-source and derived dataset redistribution provenance remains unresolved;
see [extraction licensing](adventureworks-extraction.md#licensing-and-redistribution).
Only fictional data and fictional screenshots are tracked. Real exports are
restricted to ignored `output/` by the exporter, and are never placed in `public/`,
the tracked demo, CI artifacts or hosting. Do not commit or publish real exports.

With Python 3.13, `requirements.lock` installed, and an existing valid snapshot
and analytical run (from the repository root):

```powershell
.venv/Scripts/python.exe -m src.dashboard_export
$env:AW_DASHBOARD_DATA=(Resolve-Path output/dashboard/data.json).Path
cd apps/web
npm run dev
```

On Linux, use `.venv/bin/python`, then set an absolute `AW_DASHBOARD_DATA` path in
the environment of the Node process. Unset the variable to return to the demo.
The default app input is `apps/web/data/demo.json`; no `.env` file is required.
Restart the local Node process after changing its environment.

`src.dashboard_export` verifies the current analytical pointer's evidence/database
hashes, matches its source snapshot identity, fully validates the original
snapshot and independently reconciles all model rows. It verifies logical model
hashes against the published evidence, creates the cells, and compares all six
regrouped marts including AOV. It writes the export atomically only after these
checks; rejected data leaves an existing destination unchanged. Existing
analytics/snapshot publication remains untouched. There is no automatic refresh:
a new validated analytical run requires explicitly running the export again.
Reload the dashboard after exporting to pick up its new default reporting period.

Optional flags: `--analytics-root PATH`, `--snapshot-root PATH`, and
`--destination PATH`. Real destinations must stay under repository `output/`.
The versioned envelope records source mode, snapshot identity, fingerprint,
source extraction timestamp, analytical/export revisions and export dirty state,
six reconciliation outcomes and a canonical data-content SHA-256. The browser
shows this provenance under Data & definitions. Hashes detect accidental changes;
they are not cryptographic authentication against a malicious local writer.
The Next server also validates the export schema, content hash, unique cell keys
and dimension relationships. It rejects duplicate/unknown/invalid filters.

To regenerate the fictional demo (from the repository root):

```powershell
.venv/Scripts/python.exe scripts/build_dashboard_fixture.py
# Verify content without changing the tracked fixture:
.venv/Scripts/python.exe scripts/build_dashboard_fixture.py --check
```

Logical cell content and the source input fingerprint are deterministic. Run IDs,
code revision/dirty state and physical database bytes are not required to match.
Refreshing the tracked demo is an intentional reviewed change; validate the
fixture mode, logical hash and absence of real source records before committing.

## Tests and evidence

```powershell
# apps/web
npm run format:check
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run evidence

# Repository root
.venv/Scripts/python.exe -m src.quality_check
.venv/Scripts/python.exe scripts/build_dashboard_fixture.py --check
```

The web workflow uses Node 22, `npm ci`, locked versions, formatting, TypeScript,
Vitest/React Testing Library, an actual production build, and Chromium desktop
and mobile emulation through Playwright. It tests all six routes, active navigation, filter persistence and history,
category scope, reset, search, exact tables, keyboard entry, empty responses,
invalid/duplicate API filters, no document-wide horizontal overflow and axe A/AA
checks. Python CI keeps the existing synthetic checks and adds fixture-regeneration
verification and export corruption/reconciliation tests. Neither CI workflow uses
SQL Server, private snapshots or external application services. Existing Python
and npm dependencies remain separately locked; this issue upgrades no Python
packages. Both workflows run on all PRs without path-based bypasses.

`apps/web/test-results/evidence.json` identifies local/CI context, revision/dirty
state, Node/dependency versions, lock hash, fixture fingerprints and actual unit/
browser result counts. Vitest JSON, Playwright JSON, HTML report and failed traces
remain local or in the seven-day CI artifact. Playwright artifacts have a separate
subdirectory so they do not erase the preceding Vitest report. Missing reports
are labeled incomplete; a partial run is not passing evidence.

For an existing **real local export**, start a production server with that input,
then run `scripts/check_dashboard_api.py --base-url http://127.0.0.1:PORT` from the
repository root. It compares four complete HTTP filter scenarios against fresh
read-only SQL over the published facts: all data, combined date/territory/category,
a single boundary day and an empty range. It checks every returned summary,
monthly, customer, territory, product and category row plus exact AOV and input
identity. It does not change the database. Evidence is
`output/dashboard/http-validation.json`; it remains local and is not CI evidence.

See [actual validation](issue-7-validation.md) for executed results and limits.

## Limits and future boundaries

The app reports historical shipped orders. It establishes no present-day business
trend, currency conversion, recognized revenue, returns, margin, customer names,
retention, lifetime value, SCD history or production security/concurrency claims.
Source timestamps have no stored timezone; date selection uses source wall-clock
dates. There is no automatic freshness guarantee or scheduled refresh. Dates and
dimensions available in each selection are limited to the exported snapshot.

The JSON is loaded and validated by the local server per request. Customer search
and pagination operate on the shaped customer response; this is a deliberately
bounded portfolio dashboard, without streaming, caching infrastructure or a
large-scale serving claim. Input files must be operator-controlled. Public
hosting, user accounts and remote serving require separate security/data review.

Typed KPI/chart props, centralized data access/metric formatting and a separate
web app leave ordinary extension points. A dashboard builder, saved layouts,
plugin system, user-defined metrics, arbitrary connectors, authentication,
persistence and monetization remain explicitly out of scope.
