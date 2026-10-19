# Issue #4 local validation

Local validation on October 18, 2026 (America/Los_Angeles) used the existing
SQL Server 2022 Developer instance, version 16.0.4295.3, and its existing
AdventureWorks2022 database. No replacement database/container was created.

## Executed checks

- Python 3.13.15 on Windows; DuckDB 1.5.6, PyArrow 26.0.0, dbt Core 1.12.5,
  dbt-duckdb 1.11.0. `pip check` and exact installed-version/lock comparison passed.
- Ten offline unittest methods passed, including multiple corruption subcases.
- Synthetic positive dbt build: four models and twelve data tests passed.
  Repeated synthetic reports were byte-identical. Orphan, duplicate-order and
  wrong-subtotal scenarios each exited 42 with the expected targeted test failure
  and no published report.
- Real-source extraction and independent Parquet validation passed. Repeated
  extractions and preservation of current publication on corrupt financial
  controls and injected transport interruption are exercised by
  `python -m src.integration_check`. Detailed machine-readable local evidence is
  `output/adventureworks/integration-evidence.json`; its referenced manifests
  record the tested revision, dirty state and environment.
- The dedicated account's effective SELECT permission was verified on each of
  the nine tables. INSERT, UPDATE, DELETE, ALTER and CONTROL permissions on those
  tables, broad reader/owner/sysadmin membership, database ALTER/CREATE TABLE,
  and SELECT on an unrelated excluded table were absent.

## Observed source controls

| Table | Rows |
| --- | ---: |
| Sales.SalesOrderHeader | 31,465 |
| Sales.SalesOrderDetail | 121,317 |
| Sales.Customer | 19,820 |
| Sales.SalesTerritory | 10 |
| Production.Product | 504 |
| Production.ProductSubcategory | 37 |
| Production.ProductCategory | 4 |
| Sales.SpecialOffer | 16 |
| Sales.SpecialOfferProduct | 538 |

The source has 274,914 units; header subtotal 109846381.4039, tax 10186974.4602,
freight 3183430.2518, total due 123216786.1159; detail total 109846381.399888.
Orders span 2011-05-31 through 2014-06-30. Source/snapshot counts and financial
controls reconcile. Every header subtotal matches its summed detail after
rounding **per order** to four decimals; raw global line/header totals deliberately
retain their different precisions. These are ingestion controls, not dashboard KPIs.

## Configuration and limitations

Provisioning added only `aw_snapshot_reader`, its database user, and nine explicit
table SELECT grants. No source rows, existing logins, database-wide isolation,
network ports, or container configuration were changed. Extraction uses one
SERIALIZABLE read transaction. Snapshot isolation remains off and read-committed
snapshot remains on, as observed before implementation.

Local Parquet files, credentials, raw machine evidence and generated dbt files
are ignored and excluded from Git. Early failures exposed incompatible sqlcmd
output flags, Windows stdin newline translation and a transient Windows directory
lock; the implementation corrects these and includes transport/publication
regressions. The local integration failure paths modify local control copies or
inject exceptions, never SQL Server data.

No concurrent-writer stress test, server crash/power-loss test, remote connection,
fresh-machine restore, real-source dbt mart, dashboard, or dataset redistribution
was validated. GitHub CI results must be checked separately on the PR; local
results do not imply a completed remote run. Backup provenance and dataset
redistribution review remain required before any dataset publication.
