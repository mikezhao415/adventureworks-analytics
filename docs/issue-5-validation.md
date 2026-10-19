# Issue #5 local validation

Validation on October 18, 2026 (America/Los_Angeles) consumed the existing
AdventureWorks snapshot `20261019T001836Z-ee2547d8e90749b68133c76a806f9e6f`.
Its verified input fingerprint is
`97213a5b66b6cacb8229182a65442bf8bf66c6eb9430120f01afedb8ac5cfe89`.
Latest main was confirmed at merged PR #10, commit `20bae47`, before creating
`codex/issue-5-dimensional-modeling`. No SQL Server access, data changes, container
changes, restoration or snapshot recreation were needed for this issue.

## Executed checks

- Current snapshot manifest SHA-256, fingerprint and complete snapshot validation.
- Full real-source dbt build: **23 models and 97 data tests**; enforced model
  schemas, source/model key tests, relationships, grain, row counts, header/line
  reconciliation, eligibility propagation and aggregate controls.
- Independent Python reconciliation of every row in all 23 models, including
  all dimension attributes and every grouped KPI, from original Parquet records.
- Repeatability: two snapshot-to-mart builds compared all 23 deterministic content
  hashes and eligible financial totals. Physical database bytes, timestamps and
  dbt timing metadata are not promised byte-identical.
- Five deliberate local analytical corruptions checked against independent Python
  validation and the exact targeted dbt test: duplicate fact, missing customer,
  changed line amount, duplicate product and changed summary. The published
  analytical current pointer remained unchanged during these scenarios.
- Fifteen unittest methods, including existing extraction/synthetic regression
  tests and five new dimensional integration methods with multiple subcases.
  The offline fixtures cover a two-line order, non-shipped status, nullable
  territory/category, non-additive product order counts, AOV midpoint rounding,
  no eligible orders, source-manifest tampering and failed-publication preservation.
- Existing synthetic pipeline: four models and twelve data tests; identical
  repeated report; three expected negative exits of 42 with the named failing
  test and no published report.
- `pip check`, exact installed-version/lock comparison, whitespace checks and
  generated-file/credential review. PyYAML is now explicitly listed as a direct
  dependency at the already-locked version; no dependency upgrades were required.

Python 3.13.15, DuckDB 1.5.6, dbt Core 1.12.5, dbt-duckdb 1.11.0 and PyArrow
26.0.0 were used on Windows. All generated evidence remains local under
`output/analytics/` and `output/issue5-*`. Each analytical run records its actual
code revision and dirty state, source pointer, dependency versions and results.
`output/analytics/integration-evidence.json` references the repeated runs and
targeted negative results. Do not interpret a dirty-tree run as validation of
an unchanged base commit; use its recorded state and the final committed-run
evidence when reviewing reproduction.

## Reconciled shipped-order metrics

| Control | Value |
| --- | ---: |
| Orders | 31,465 |
| Lines in all-status fact | 121,317 |
| Units | 274,914 |
| Net line sales | 109846381.399888 |
| Header subtotal | 109846381.4039 |
| Tax | 10186974.4602 |
| Freight | 3183430.2518 |
| Total due | 123216786.1159 |
| Average order value, header subtotal/orders | 3491.0657 |

All source orders in this snapshot have shipped status. The independent checks
preserve the raw line/header precision difference and apply the verified
four-decimal rounding rule per order. No currency denomination or recognized
revenue claim is attached to these controls.

The real run produced 19,820 customers; 504 products; 5 category members (including
Uncategorized); 11 territory members (including Unknown); 16 promotions; and 1,127
calendar dates. Marts have 1 summary row, 38 months, 19,119 customers with sales,
266 products with sales, 4 categories with sales and 10 order territories with sales.

## Limitations and delivery status

See [model and metric contracts](dimensional-modeling.md) for exact grains,
current-attribute treatment, source monetary units, eligibility and date conventions.
No fresh-machine restore, remote database path, SCD history, currency conversion,
returns, margin, recognized revenue, dashboard, large-dataset streaming or
concurrent-writer/crash durability test was performed. Dataset redistribution
provenance remains a prerequisite for any later dataset publication.

Snapshots, DuckDB files, raw dbt artifacts and credentials are excluded from Git.
Remote GitHub Actions results are separate from these local results and must be
checked on the draft PR. Issue #5 remains open pending review and merge approval;
Issues #6, #7 and #8 retain the automation, BI delivery and publication follow-ups.
