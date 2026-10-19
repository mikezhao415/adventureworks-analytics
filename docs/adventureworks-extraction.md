# AdventureWorks extraction and snapshots

Issue #4 implements an opt-in local ingestion workflow. It reads the existing
SQL Server 2022 / AdventureWorks2022 database and publishes validated local
Parquet snapshots. A separate [Issue #5 analytical project](dimensional-modeling.md)
now consumes these snapshots; dashboards remain future work. The original dbt
project still processes its synthetic fixture.

## Prerequisites and acquisition

Use Python 3.13, Docker Desktop with access to an existing Linux SQL Server 2022
container, and `/opt/mssql-tools18/bin/sqlcmd` in that container. Its database
must be named `AdventureWorks2022`. No host SQL port or host ODBC/Python SQL
driver is required: Python sends SQL over `docker exec` to the installed client.
No second SQL Server environment is created. Docker access is privileged local
access; the database account itself has narrow read permissions.

For a fresh machine without the sample, obtain **AdventureWorks2022.bak** (OLTP,
not AdventureWorksDW/AdventureWorksLT/2025) from Microsoft's
[AdventureWorks release](https://github.com/microsoft/sql-server-samples/releases/tag/adventureworks).
Follow Microsoft's [backup restore instructions](https://learn.microsoft.com/en-us/sql/samples/adventureworks-install-configure?view=sql-server-ver16).
Restore it once into your local SQL Server 2022 instance using the actual logical
file names and container data paths. Do not use `WITH REPLACE` against an existing
database. Acquisition/restoration is a manual prerequisite; this repository does
not download backups, install SQL Server, recreate containers, or restore data.

Create the Python environment from the repository root:

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.lock
```

On Linux, use `.venv/bin/python` in place of `.venv/Scripts/python.exe`.
The existing Linux CI runs offline snapshot tests and synthetic dbt validation;
the real-source transport has been exercised locally on Windows.

## Dedicated account and credentials

Inspect the existing container name with `docker ps`. Explicitly run provisioning
once, substituting that name:

```powershell
.venv/Scripts/python.exe -m src.provision_reader --container YOUR_EXISTING_CONTAINER
```

This uses the container's existing `MSSQL_SA_PASSWORD` for provisioning only. It
creates `aw_snapshot_reader`, a mapped database user, and SELECT grants on the
nine tables below. It does not grant `db_datareader`, create tables, modify source
rows, change isolation settings, or publish network ports. Provisioning refuses
an existing `.env` or login rather than silently overwriting credentials. An
interrupted setup may leave an empty `.env` reservation; inspect database login
state and recover deliberately before retrying. Do not print the generated SQL
or provider diagnostics, which may contain the password during provisioning.

Generated credentials are saved to ignored `.env` with `AW_CONTAINER`,
`AW_SQL_USER`, and `AW_SQL_PASSWORD`. Restrict access to that file using your local
OS permissions; Windows ACLs are inherited. Never commit or upload it. Existing
environment variables take precedence over `.env`. Administrators can instead
provision the same explicit table SELECT grants manually and supply these three
variables through a secret store. No administrator credential is used by extraction.

Passwords travel to the container over binary stdin, not process arguments or
command output. The local sqlcmd connection uses encryption with `-C` to trust
the container certificate; remote TLS identity validation is not implemented.

## Execute and validate

```powershell
.venv/Scripts/python.exe -m src.extract
.venv/Scripts/python.exe -m src.integration_check
```

The first command creates a new snapshot under `output/adventureworks/`. The
second checks effective reader permissions, performs **two independent real-source
extractions**, compares their logical fingerprints and financial controls, rejects
a deliberately corrupted local control and an injected interruption, and verifies
the previous current snapshot survives. It never injects corruption into SQL Server.
The source must remain unchanged between repeated runs for repeatability to pass.

Revalidate an existing snapshot without Docker or credentials:

```powershell
.venv/Scripts/python.exe -m src.extract --validate output/adventureworks/SNAPSHOT_ID
```

An alternate `--root` must be a local directory on one filesystem, outside tracked
source paths. Consumers should read `current.json`, verify its manifest SHA-256,
then validate the referenced snapshot before use. Snapshot files are immutable by
application convention, not protected against deliberate filesystem modification.
SHA-256 detects accidental changes; manifests are not authenticated signatures.

## Contracts and extraction boundary

The authoritative column lists, Arrow schemas, nullability, primary keys, and
included foreign-key relationships are in `src/contracts.py` (contract version 1).
The extractor reads **all rows of those selected columns**, without a reporting
date/status filter, ordered by the declared primary keys.

| Table | Grain / primary key | Selected content |
| --- | --- | --- |
| Sales.SalesOrderHeader | SalesOrderID | Dates, status, channel, customer/territory IDs, subtotal, tax, freight, total due, ModifiedDate |
| Sales.SalesOrderDetail | SalesOrderID + SalesOrderDetailID | Quantity, product/offer IDs, price, discount, LineTotal, ModifiedDate |
| Sales.Customer | CustomerID | Person/store/territory identifiers, ModifiedDate |
| Sales.SalesTerritory | TerritoryID | Name, country code, group, ModifiedDate |
| Production.Product | ProductID | Name, number, color, subcategory, cost/list price, lifecycle dates, ModifiedDate |
| Production.ProductSubcategory | ProductSubcategoryID | Category ID, name, ModifiedDate |
| Production.ProductCategory | ProductCategoryID | Name, ModifiedDate |
| Sales.SpecialOffer | SpecialOfferID | Description, percentage, type/category, dates, quantity limits, ModifiedDate |
| Sales.SpecialOfferProduct | SpecialOfferID + ProductID | Product/offer relationship, ModifiedDate |

Source types/nullability for every selected field are checked before publication.
SQL `money` becomes decimal(19,4); `smallmoney` becomes decimal(19,4) without
precision loss; computed `LineTotal` stays decimal(38,6). SQL integers are widened
to int32; `bit` becomes boolean; Unicode strings remain strings. SQL datetime
values become timezone-free microsecond timestamps, preserving their returned
value without inventing a timezone. Extraction timestamps are separately UTC.
Nullable source references remain null. New unselected source columns are ignored;
changes to selected columns require an intentional contract update.

One SQL Server session uses an explicit **SERIALIZABLE transaction** for metadata,
data reads and independent aggregate controls. Shared/range locks provide a
serializable boundary across statements under the existing database configuration.
This can block writers or encounter a deadlock; it is appropriate for this local
sample workflow. It is not an as-of timestamp or database snapshot feature.
There are no `NOLOCK` reads and no database-wide isolation changes. The manifest's
start time describes the run, not a claim that every row was frozen at that instant.
The transaction commits before local validation. Missing completion markers,
SQL errors, lock timeouts (30 seconds), statement timeouts (180 seconds), or overall
transport timeouts (600 seconds) fail extraction. Provider diagnostics are suppressed
to avoid leaking credentials or source records; resolve connectivity with a safe
SELECT and inspect sanitized administrative diagnostics locally when needed.

## Financial and relational validation

SQL Server independently calculates row counts, duplicate-key groups, orphan
counts for all included relationships, header financial totals, line count/units/
amount, date bounds, and monthly/status header totals in the same transaction.
DuckDB recomputes those controls by reopening the Parquet files. Snapshot keys,
required fields, schema, file hashes, row order and logical fingerprints are also
validated. Customer person/store references are retained as identifiers, but their
target tables are outside the contract and are not checked as extracted relationships.

The detail-to-offer relationship uses **both SpecialOfferID and ProductID**.
Product then connects to subcategory/category. Header totals are aggregated without
joining to detail, preventing header financial amounts from being multiplied.

Each line is independently checked using decimal Python arithmetic at precision 60:
`UnitPrice * (1 - UnitPriceDiscount) * OrderQty`, rounded to six decimals with
half-away-from-zero behavior. Each order's **sum of six-decimal LineTotal values is
rounded once to four decimals** and compared exactly with SubTotal. TotalDue must
equal SubTotal + TaxAmt + Freight. No arbitrary global financial tolerance is used.
The verified source has small raw differences between line sums and money values;
rounding each line first or rounding only the global total would use the wrong rule.

These are source amount controls, not recognized revenue or returns analytics.
No currency conversion, currency aggregation policy, cancellation/returns model,
or reporting timezone is inferred. Status and channel values are preserved for
later metric contracts. Current product cost/list price is not historical order cost.

## Manifests, publication and failures

Each snapshot contains nine Parquet files, `manifest.json`, and `validation.json`.
The manifest records source database/version and run start, code revision and dirty
state, Python/platform/library versions, schemas, row counts, file sizes, SHA-256
checksums, per-table logical content hashes, independent controls, limitations,
and a combined input fingerprint. Decimal controls are strings in JSON.

Logical fingerprints hash canonical typed rows in primary-key order and include
the selected schemas and counts. Identical selected inputs have matching logical
fingerprints; run IDs/timestamps differ. Byte-level Parquet checksums are integrity
checks and are not promised stable across library/platform changes. The fingerprint
identifies the **selected input**, not the entire source database or backup file.

The extractor acquires an exclusive local publication lock, writes a unique staging
directory, closes/reopens files for validation, writes evidence, and renames the
directory to a unique final name. It then atomically replaces `current.json`, which
contains the snapshot ID, manifest SHA-256 and input fingerprint. Existing snapshots
are never overwritten. Windows directory rename retries are bounded.

On failure, only that run's staging directory is removed and a sanitized failure
record is retained. A failure after final-directory rename can leave an unreferenced
validated snapshot, while the old current pointer remains valid. A process crash can
leave staging/lock files: confirm no extraction is running before manually removing
only that run's stale files. Automatic crash recovery, retention/garbage collection,
network filesystem guarantees, and power-loss durability are outside this milestone.
The implementation buffers this modest sample in memory; Parquet row groups are
bounded, but source transport and validation are not a large-dataset streaming design.

## Checks and evidence

```powershell
.venv/Scripts/python.exe -m unittest discover -s tests -v
.venv/Scripts/python.exe -m pip check
$env:PATH = (Join-Path (Get-Location) '.venv\Scripts') + ';' + $env:PATH
.venv/Scripts/python.exe src/run.py
```

Retain the existing synthetic positive/repeatability/negative checks from
`docs/synthetic-slice.md`. Offline regression tests cover decimal rounding,
Unicode, schema drift, missing rows/nulls, duplicate keys, orphans, incorrect
financial controls, changed file bytes, incomplete manifests, interruption,
concurrent publication, and credential transport. They do not start a SQL Server.

`output/adventureworks/integration-evidence.json` records real-source repeatability,
financial controls, manifest hashes, account permission checks, and rejected failure
cases. Its referenced manifests contain revision/environment provenance. Generated
snapshots and evidence remain ignored and local; synthetic CI artifacts remain
separately labeled. CI success does not establish a real-source integration run.
See `docs/issue-4-validation.md` for the reviewed local validation summary.

## Licensing and redistribution

Microsoft's [sample repository license](https://github.com/microsoft/sql-server-samples/blob/master/license.txt)
identifies its sample code as MIT and requires preserving its notice. The
[AdventureWorks README](https://github.com/microsoft/sql-server-samples/blob/master/samples/databases/adventure-works/README.md)
documents the version-specific backup acquisition path. Those references do not
establish the provenance or redistribution permission of the exact already-restored
backup used locally. Record the acquisition URL, artifact hash and applicable terms
before redistributing any source or derived dataset. This PR distributes neither.
SQL Server/Docker licensing and this project's code license are separate questions;
the project-wide code license remains unselected. Installed package metadata identifies
PyArrow as Apache-2.0 and python-dotenv as BSD-3-Clause. Review their full notices
and transitive dependencies when redistributing dependencies; no dependency
binaries are committed.
