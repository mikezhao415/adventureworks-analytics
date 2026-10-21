# AdventureWorks 2022 aggregate artifact review — Issue #16

> **Release outcome — 2026-10-20:** This document preserves the **pre-release review and approvals as they stood at that time**; statements below that merge or deployment was not authorized are historical. The user subsequently approved public redistribution, marking PR #17 ready, squash merge, and Production deployment. [PR #17](https://github.com/mikezhao415/adventureworks-analytics/pull/17) merged as `b56b49a18df9c12c4d61c344894fcf0395d20e3a`; Vercel Production deployment `dpl_Emr6TvNx5sVNsa2jgqpd74QQCyTr` reached READY at https://adventureworks-analytics-flax.vercel.app/. The reviewed PR head passed both BI quality/reproducibility and Sales dashboard workflows. The owner confirmed live sample labeling, customer search/sort, filters, `/api/dashboard` JSON, and `/definitions` Microsoft attribution and historical disclosure. Automated hosted-page inspection was blocked by Vercel permissions; Production functional smoke checks are **owner-reported**, not independently HTTP-verified. [Issue #16](https://github.com/mikezhao415/adventureworks-analytics/issues/16) is closed; parent #8 remains open. Original backup acquisition URL/hash and an independent asset-level license grant remain unverified; publication assessment is conditional, not legal clearance. Future artifact replacements and releases require separate approval.

October 20, 2026: **exact artifact approved for repository publication and draft PR; deployment not approved**.
The [machine-readable manifest](dashboard-artifact-review.json) records its exact identity.
The user explicitly authorized staging the 32 listed paths, committing and pushing the exact artifact, and creating a public-repository draft PR. Merge, ready-for-review status, deployment, Issue #16 closure and production configuration changes remain unauthorized.

## Source and licensing assessment

Upstream: Microsoft's [AdventureWorks release](https://github.com/microsoft/sql-server-samples/releases/tag/adventureworks), `AdventureWorks2022.bak` (OLTP), and [installation instructions](https://learn.microsoft.com/en-us/sql/samples/adventureworks-install-configure).
Acquisition was around October 9, 2026, per the user. The exact original download URL and acquisition backup hash are unverified. The official release is the recommended reproduction source, not proof of where the local backup was downloaded. No replacement download/restore was performed in this review.

On October 20, 2026, Microsoft's [SQL samples overview](https://learn.microsoft.com/en-us/sql/samples/sql-samples-where-are) described samples/templates as MIT-licensed; the [repository notice](https://github.com/microsoft/sql-server-samples/blob/master/license.txt) permits redistribution of covered materials with its copyright/permission notice. This supports a **conditional assessment, not legal clearance**. A separate asset-specific grant for the backup's underlying data has not been located. Acquisition provenance remains incomplete. Approval must acknowledge these limitations; obtain legal review if greater certainty is required. Microsoft's notice does not license this project's original code or imply endorsement. The complete notice is preserved at `apps/web/public/notices/microsoft-sql-server-samples.txt` and linked from Data & Definitions. See [redistribution policy](data-redistribution.md).

## Exact bytes and scope

Input: ignored `output/dashboard/data.json`. Proposed fixed path: `apps/web/data/adventureworks2022.json`, byte-identical and explicitly approved for Git staging/commit/push.

- Bytes: **16,136,806** (15.39 MiB).
- Full-file SHA-256: `b4b22c99becf5b7e26a53c8b3d04280b99db3fd28b2dccf9d16c01c682e80040`.
- Canonical data SHA-256: `2204bd6a695c0657692e28e9848b5eb1628b50e3dfb463683d322487824938dd`.
- Snapshot: `20261019T001836Z-ee2547d8e90749b68133c76a806f9e6f`.
- Analytics revision: `a62763ff7f867e859819ceff3f541641bb943143`.
- Export revision: `9b2e711b4ab495540324a8d4e36e1142321b96e8`; export tree clean.
- Fingerprint: `97213a5b66b6cacb8229182a65442bf8bf66c6eb9430120f01afedb8ac5cfe89`.
- Version 1; mode `real_adventureworks`; reporting period 2011-05-31–2014-06-30.

All fields and all 504 product names were inventoried. There are 31,406 customer cells, 68,520 product cells and 11,330 category cells. Dimensions contain 504 products, 5 categories and 11 territories including unknown/uncategorized members. There are 19,119 distinct numeric customer keys (11000–30118); product keys span 1–999. Product names describe sample bicycle parts, apparel and accessories; territories are sample region/country labels. Customer display labels are generated from numeric keys.

Cell fields are date, territory key, customer/product/category key, order count, units and six-decimal net line sales. Customer cells additionally hold four-decimal header subtotal, tax, freight and total due. Dimensions contain key/name and product category key. Envelope fields are version, content hash and provenance: mode, revisions, snapshot, fingerprint, extraction timestamp, dirty state and reconciliation results.

No customer names, contact details, addresses, credentials, order IDs, raw transactional rows, images, embedded links or binary assets were found. Numeric identifiers are linkable to the upstream fictional sample, and some daily cells contain one order. This is **not anonymized data**; aggregation is not a privacy guarantee. Approval includes numeric customer identifiers and the shaped customer totals exposed by the UI/API, not just high-level KPIs. Backups, Parquet, DuckDB and source credentials are excluded from distribution.

Customer-cell controls: 31,465 shipped orders; 274,914 units; net line sales 109846381.399888; header subtotal 109846381.4039; tax 10186974.4602; freight 3183430.2518; total due 123216786.1159. The line/header precision difference is preserved. These fictional historical amounts use the [reviewed native USD presentation](currency-interpretation.md), without FX conversion, recognized revenue or actual business performance claims.

## Lineage and reproducibility

Read-only SQL Server extraction of nine contracted tables → validated immutable Parquet/manifest → DuckDB/dbt facts/dimensions → independent reconciliation → `python -m src.dashboard_export` → three daily filter-safe cell sets. Headers and lines are aggregated independently; category filters affect only product/category views, and overlapping order counts remain non-additive. The exporter checks physical/logical hashes and original snapshots before atomic publication.

The exact export embeds six passing mart controls: summary 1, monthly 38, customer 19,119, territory 10, product 266 and category 4 rows. Embedded outcomes are export-time evidence; newly executed checks are reported separately below.

Follow [extraction](adventureworks-extraction.md), [modeling](dimensional-modeling.md) and [dashboard](sales-dashboard.md). Acquisition/restoration remains manual. CI must not download the sample or require SQL Server. New exports include run IDs, timestamps, revisions and dirty state; equal analytical content need not yield identical full-file hashes. Never rewrite provenance to impersonate this candidate. Any changed bytes require fresh review and pins. Original `data/demo.json` is unchanged for development, fixture reproduction and rollback. A path-specific `.gitattributes` rule marks only the proposed sample JSON `-text whitespace=cr-at-eol`, preserving the full-file hash across checkouts despite local `core.autocrlf=true`. The approved file includes CRLF; the whitespace attribute recognizes that intentional line ending without rewriting its bytes. `git check-attr text` reports unset, and read-only filtered/unfiltered `git hash-object` results match; no staging or object write was performed.

## Production boundary and local validation

Production ignores `AW_DASHBOARD_DATA` and reads only the fixed packaged artifact. Length and whole-file hash are checked before parsing; schema, grain, FK and recomputed canonical content checks follow, with explicit sample mode, snapshot and internal hash pins. Missing/unexpected files fail closed (API 503), without fixture fallback. Next.js traces the fixed file for every server page and API route outside `public/`; it explicitly excludes demo.json from production traces. Browsers receive shaped responses. No runtime git command, database or credentials are needed. Each load rechecks the file bytes. Only a successful validated document is reused within the process, deeply frozen to prevent request mutation. Cold processes repeat full validation. Pins establish release identity, not protection against an attacker changing both code and data.

Default Playwright exercises the fictional development server without a source dataset. `AW_E2E_SAMPLE=1 npm run test:e2e` exercises the same desktop/mobile/navigation/filter/keyboard/axe suite against the production sample build, with an invalid runtime override. Sample runs cannot capture tracked screenshots. Unit policy tests use explicitly fictional content with test-only pins; actual-candidate validation is separate.

## Final pre-publication serialization review

The 16.1 MB daily artifact was never serialized into pages. The complete **composed** `DashboardData` was passed from `AnalyticsPage` to a client `Dashboard`, so Next.js embedded all 19,119 customer aggregates and unrelated monthly/product/territory rows into each route's HTML hydration/RSC props. About 3.60 MB of RSC data was present even on Filters. The remaining HTML overhead included escaping those props and rendered markup.

`lib/page-data.ts` now projects typed view-specific props after unchanged complete analytical composition. Overview receives exact summary/counts; Trends receives all monthly rows; Products receives all product/category rows; Territories receives all territory rows; Filters receives only applied filters (with shared provenance/options supplied separately). Only Customers receives customer values, encoded as named tuples to avoid repeated JSON field names. Every one of the 19,119 selected customers retains its ID, label, order count, exact line sales, contribution and exact AOV. Search, four sorts, pagination and independent comparison ranges still operate over the complete selection. No row limit or decimal reduction was added. Unused customer units/header-subtotal fields remain available in the unchanged complete API and original artifact.

Local production responses, uncompressed bytes, same exact input:

| Route | HTML before | HTML after | RSC before | RSC after |
| --- | ---: | ---: | ---: | ---: |
| `/` | 4,152,260 | 18,231 | 3,596,605 | 5,408 |
| `/trends` | 4,155,392 | 27,866 | 3,597,012 | 11,582 |
| `/products` | 4,154,512 | 73,071 | 3,597,027 | 51,946 |
| `/customers` | 4,160,256 | 1,362,995 | 3,597,018 | 1,151,423 |
| `/territories` | 4,161,685 | 29,380 | 3,597,036 | 7,347 |
| `/filters` | 4,152,363 | 18,092 | 3,597,010 | 5,597 |
| `/definitions` | 28,112 | 28,112 | 12,411 | 12,411 |

The complete API response remains **3,592,604 bytes**, byte-identical before/after (SHA-256 `32ffa68941c06e7b4d299cfb02b71a45f1107c74c371b7936588195efd7d6efd`). Definitions was already independent of full analytics props and is unchanged. The largest measured HTML is now **1,362,995 bytes**, and largest RSC is **1,151,423 bytes**, both Customers. Other analytics HTML responses are 18–73 KB. Measurements are loopback Node 22.23.2 production responses with identity encoding; locally calculated gzip is not a CDN transfer measurement. Requests with `RSC: 1` verify the Flight response content type, not just HTML. Raw reports remain ignored at `output/dashboard/page-payloads-before.json` and `page-payloads-after.json`. Reproduce with `node scripts/measure-page-payloads.mjs before` on the pre-change build and `after` on the rebuilt app, using a controlled loopback production server on port 3100.

`node scripts/benchmark-artifact.mjs` repeats the unchanged full loader/composition workload in a local Vite harness: cold validation **2784 ms**, warm file verification **62–101 ms**, full API composition/serialization **483–694 ms**. Peak RSS was **336,982,016 bytes (321 MiB)**, including Vite/transient allocations. The projection reduces wire data; it does not claim lower full-composition CPU or hosted cold-start latency. OS cache state and concurrent host activity are uncontrolled. Machine evidence is `output/dashboard/performance.json`.

Final API trace: **122 files, 18,064,954 bytes (17.23 MiB)** including the exact artifact and notice, excluding the fixture. This is a Next.js trace sum, not a deployed bundle measurement; adapter/runtime layers and grouping can add bytes or duplicate the dataset across functions. The [Vercel limits](https://vercel.com/docs/functions/limitations), rechecked October 20, 2026, describe a standard 250 MB Node bundle and 4.5 MB response cap. Measured HTML/RSC now have substantial headroom; the unchanged full API still measures 3.59 MB. Compression is not relied on to evade the cap.

## Final content and negative-path review

`node scripts/review-artifact.mjs` revalidated both source/candidate byte equality, pinned full/internal hashes, schema/grain/FKs, exact field allowlists for **every** envelope/provenance/control/cell/dimension object, manifest identity and counts, reporting-date bounds, and string patterns for embedded URLs/HTML/contact/credential markers. It found **zero unexpected fields and zero pattern matches**. The prior human inventory of all product labels remains applicable because bytes are unchanged. Pattern checks supplement human review; they do not establish anonymization or legal clearance.

The real production route and loader were exercised in an isolated directory through the local Vite harness with a valid fictional runtime override: exact candidate → **200**; same-length, valid-JSON financial-digit alteration after warm load → **503**; file removal → **503**; exact restoration → **200**. Original candidate/source files were never modified. Both retain the reviewed hash. The original fictional fixture matches `HEAD` after newline normalization and remains `offline_fixture`; fixture-content reproduction also passed. Evidence is `output/dashboard/artifact-audit.json`. This tests the production route code locally, not a deployed Vercel function.

Final local validation: **33 unit tests, 12 production-sample browser tests and 12 fictional-fixture browser tests passed with zero failures/skips**; formatting, TypeScript, production build, six independent HTTP/SQL scenarios, fixture reproduction and exact artifact audit passed. The adjacent manifest records the same outcomes. No lint script is configured. The earlier 22-test offline Python/dbt quality run remains valid prior evidence; Python implementation did not change in this serialization review. SQL Server was not accessed. Six HTTP scenarios were rerun against independent read-only DuckDB facts. Local/CI and hosted execution boundaries remain explicit; no CI or deployment was initiated.

Remaining risks: sample-data redistribution remains a conditional assessment with the original acquisition URL/backup acquisition hash unverified; retained numeric sample IDs are linkable, not anonymized. Cold validation and complete API composition remain material costs. The Customers page still transfers every selected customer (1.36 MB HTML), deliberately preserving client search/sort behavior; server-side pagination is a possible separately tested future optimization if hosted performance is inadequate. No truncation, downsampling, new service or live database was introduced. Hosted/adapter/concurrency validation and explicit deployment/merge approvals remain outstanding.

## Release gates and rollback

1. **Repository publication approved October 20, 2026:** the user approved the exact JSON bytes/hash, numeric identifier scope, conditional licensing assessment, acquisition caveat and notice for the 32-path staging set and a public-repository draft PR. Every changed artifact requires fresh review and explicit approval.
2. Stage exactly the reviewed 32 paths, verify the index bytes and file list, commit/push the feature branch, then prepare a draft PR and inspect CI/package results. Parent #8 case-study work remains separate; no issue closure is authorized.
3. Separate merge approval after required checks; separate approval for any preview/public deployment. Deployment-specific limits and smoke validation remain outstanding. Do not modify production environment variables.
4. Keep the current fixture deployment available. Any later rollback requires explicit authorization and the prior matching loader/build; substituting `demo.json` into the new pinned loader must fail.


## Local browser execution detail

The initial uncached run exposed a mobile reset-navigation timeout during concurrent HTTP checking. The warmed loader resolved it. A subsequent packaging assertion caught Next.js retaining the fixture trace; explicit exclusion resolved that. Final sample tests passed after both changes.

In this Windows sandbox, Playwright's managed-server teardown hung after browser cases. The final runs used an ignored `apps/web/test-results/external.config.ts` that imports the committed configuration, keeps the same tests/projects/reporters, sets absolute test/output directories, and disables only `webServer`. A separately controlled loopback Next server supplied the actual production build with `AW_DASHBOARD_DATA=publication-override-must-not-load.json`. This allowed Playwright to finish and write JSON/evidence reports. It is not a deployed or Vercel runtime. Standard Linux CI managed-server execution remains unexecuted for this branch; no push/PR was authorized.

Sample and fixture reports are preserved locally under ignored `output/dashboard/sample-validation/` and `output/dashboard/fixture-validation/`; independent reconciliation is `output/dashboard/http-validation.json`. Generated reports, traces and page payload measurements must remain local.


The exact proposed staging set is [issue-16-staging.txt](issue-16-staging.txt). It is a review list only, including the single exact artifact now explicitly approved for repository publication. Staging and commit audits are recorded separately during draft PR preparation. Output reports, temporary server configuration, node_modules, `.next`, snapshots, credentials and screenshots are excluded.


The final evidence consistency review caught the temporary external configuration resolving a relative reporter path into a nested directory while the evidence writer read an older root report. Reporter paths are now absolute and Playwright records its data mode. The evidence writer returns incomplete if report mode is missing or differs from the requested input mode; an old untagged report was explicitly verified to produce incomplete. Both 12-test browser suites were rerun afterward. Their raw JSON counts, modes and timestamps match the preserved evidence and adjacent manifest. The first fixture attempt also encountered development reload churn while review files were changing; restarting the development server and keeping source files stable during the final run produced all 12 passing tests.
