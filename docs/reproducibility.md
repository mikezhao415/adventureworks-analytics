# Reproducibility

The [published dashboard](https://adventureworks.mikezhao.dev) reports Microsoft's fictional, historical AdventureWorks 2022 sample data, not a live production dataset. The [case study](https://mikezhao.dev/projects/adventureworks-analytics), [business narrative](https://mikezhao.dev/projects/adventureworks-analytics/business), and [technical implementation](https://mikezhao.dev/projects/adventureworks-analytics/technical) explain the results and decisions. Viewing the approved aggregate locally does not reproduce its upstream extraction.

## Choose a path

| Path | Inputs and prerequisites | What it establishes |
| --- | --- | --- |
| A: dashboard only | Git checkout, Node/npm, checked-in fixture or approved aggregate | Local UI/API behavior for that input; no source extraction |
| B: full pipeline | Python environment, manually acquired/restored SQL Server sample, Docker/sqlcmd and dedicated reader | A new validated snapshot, DuckDB/dbt run and dashboard export from your local source |

Commands below use PowerShell and start at the repository root unless a different directory is stated. On Linux, replace `.venv/Scripts/python.exe` with `.venv/bin/python` and use your shell's environment-variable syntax. Package installation requires network access. Generated `output/`, credentials, databases, reports and source snapshots stay local and ignored.

## Versions and locks

- Python **3.13**, as configured in the BI workflow. [requirements.txt](../requirements.txt) lists direct dependencies; install [requirements.lock](../requirements.lock) for the pinned environment, including transitive dependencies.
- Node **22** is the CI/local validation baseline. [apps/web/package.json](../apps/web/package.json) declares supported Node versions and direct dependencies; [package-lock.json](../apps/web/package-lock.json) pins the complete npm dependency tree. Run `npm ci` in `apps/web`. Issue #8 records hosted Node 24.x; this is separate from the recorded Node 22.23.2 local artifact measurements, not a freshly inspected hosting setting.
- Path B uses SQL Server **2022**, database **AdventureWorks2022** (OLTP), and `/opt/mssql-tools18/bin/sqlcmd` inside an existing Linux container. Docker access is privileged; the extraction database account has only the nine contracted table SELECT grants.

## Path A: run the dashboard locally

### Project-created fictional fixture

From the repository root:

```powershell
Remove-Item Env:AW_DASHBOARD_DATA -ErrorAction SilentlyContinue
cd apps/web
npm ci
npm run dev
```

Open the loopback URL printed by Next.js. Development defaults to `apps/web/data/demo.json` with `offline_fixture` provenance. The first command clears any existing development data override. The fixture is project-created fictional test data, not AdventureWorks-derived records. No Python, SQL Server, Docker or credentials are needed. Stop the server before switching modes.

### Approved historical sample aggregate

In `apps/web`, after `npm ci`:

```powershell
npm run build
npm run start
```

Production serves only checked-in `apps/web/data/adventureworks2022.json` with `real_adventureworks` provenance and pinned file/content hashes and snapshot identity. It ignores `AW_DASHBOARD_DATA`, validates the approved bytes and fails closed rather than falling back to the fixture. `/definitions` identifies the source and Microsoft attribution; `/api/dashboard` returns shaped data and reconciliation provenance. The aggregate is bundled with the app; no database or analytics process runs inside Next.js. Do not build while a server uses the same `.next` output.

This is reproduction of dashboard serving with the approved artifact, not permission to redistribute new artifacts. Preserve the path-specific `.gitattributes` rule and [Microsoft notice](../apps/web/public/notices/microsoft-sql-server-samples.txt). Do not regenerate or replace the tracked aggregate.

### Dashboard checks

In `apps/web`, with no server occupying port 3100:

```powershell
npm run format:check
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run evidence
```

There is no configured lint script. Default Playwright starts the development fixture server and covers desktop/mobile, navigation, filters, keyboard and axe checks. Preserve `test-results/` and `playwright-report/` locally before the next run. Then exercise the production sample using the existing build:

```powershell
$env:AW_E2E_SAMPLE = '1'
try {
    npm run test:e2e
    npm run evidence
} finally {
    Remove-Item Env:AW_E2E_SAMPLE -ErrorAction SilentlyContinue
}
```

The sample suite starts a production server with an invalid override to test source isolation. Evidence must identify matching mode, revision, timestamp and actual test counts; missing/stale reports are not a pass. See [dashboard tests and evidence](sales-dashboard.md#tests-and-evidence) and [controlled Windows server guidance](dashboard-publication.md#windows-controlled-server-verification). These checks do not establish hosted performance, full screen-reader coverage or complete accessibility/security compliance.

## Path B: reproduce source to validated export

### 1. Install Python dependencies and run offline gates

From the repository root, using Python 3.13:

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.lock
.venv/Scripts/python.exe -m pip check
.venv/Scripts/python.exe -m src.quality_check
.venv/Scripts/python.exe src/run.py
.venv/Scripts/python.exe scripts/build_dashboard_fixture.py --check
```

These are offline fixture checks and the synthetic pipeline, not full-source validation. The fixture check runs dbt and creates ignored `output/dashboard-fixture` intermediates; `--check` avoids modifying tracked `demo.json`. Quality evidence is under `output/quality/`; the synthetic report is `output/report.json`. See [quality automation](quality-automation.md) for negative tests, dependency resolution comparison, evidence and recovery.

### 2. Acquire the source and configure the reader

Obtain the OLTP `AdventureWorks2022.bak` from Microsoft's [official release](https://github.com/microsoft/sql-server-samples/releases/tag/adventureworks) and follow Microsoft's [restore instructions](https://learn.microsoft.com/en-us/sql/samples/adventureworks-install-configure?view=sql-server-ver16). Use the actual backup logical filenames and container paths; do not overwrite an existing database. The repository does not automate download, container installation or restore. Record your acquisition URL, date, backup SHA-256 and applicable terms locally. A newly acquired backup is not proof of the provenance of the originally used backup.

Follow [extraction prerequisites and account setup](adventureworks-extraction.md). After completing step 1, inspect the existing setup before choosing the one-time provisioning command. From the repository root:

```powershell
.venv/Scripts/python.exe -m src.provision_reader --container YOUR_EXISTING_CONTAINER
```

Replace `YOUR_EXISTING_CONTAINER` with the existing container name. Provisioning creates a login and ignored `.env`; it changes account configuration and refuses an existing login or `.env`. Alternatively, an administrator can supply the documented narrow grants and `AW_CONTAINER`, `AW_SQL_USER`, `AW_SQL_PASSWORD`. Do not print or commit credentials. Extraction uses the dedicated reader, not the administrator credential.

### 3. Extract and verify local snapshots

With the source and reader configured, from the repository root:

```powershell
.venv/Scripts/python.exe -m src.extract
.venv/Scripts/python.exe -m src.integration_check
```

Extraction reads nine contracted tables in a serializable read-only transaction, independently reconciles SQL controls against Parquet and publishes `output/adventureworks/current.json` only after validation. The integration check performs two additional real-source extractions, checks reader permissions and repeatability, and rejects local corruption/interruption without modifying source records. Keep the source unchanged during repeated runs. Evidence: `output/adventureworks/integration-evidence.json` plus per-snapshot manifest and validation files.

To validate an existing snapshot without SQL Server, run from the repository root, replacing `SNAPSHOT_ID` with its actual directory name:

```powershell
.venv/Scripts/python.exe -m src.extract --validate output/adventureworks/SNAPSHOT_ID
```

The fingerprint covers selected contracted data, not the whole backup. See [extraction contracts and limits](adventureworks-extraction.md).

### 4. Build and independently reconcile models

```powershell
.venv/Scripts/python.exe -m src.analytics
.venv/Scripts/python.exe -m src.analytics_check
```

The default input collection is `output/adventureworks`; output is `output/analytics`. The build validates the current snapshot, loads DuckDB, runs 23 dbt models and 97 tests, and reconstructs model rows independently in Python. Only validated runs replace `output/analytics/current.json`. Each run retains `analytics.duckdb`, `evidence.json`, dbt results and logs.

`analytics_check` creates two additional builds, compares logical model hashes/totals, runs five targeted negative scenarios on local copies, and writes `output/analytics/integration-evidence.json`. It is not a read-only inspection command. SQL Server is no longer needed once a valid snapshot exists. See [modeling](dimensional-modeling.md) for grains, metric contracts and optional roots. A different snapshot may produce different row counts or totals; physical database bytes and run IDs are not the reproducibility oracle.

### 5. Export and inspect in development

```powershell
.venv/Scripts/python.exe -m src.dashboard_export
$env:AW_DASHBOARD_DATA = (Resolve-Path output/dashboard/data.json).Path
cd apps/web
npm ci
npm run dev
```

The exporter revalidates the original snapshot, analytical evidence/database hashes, every model and all six regrouped dashboard marts before atomically writing `output/dashboard/data.json`. Expected output reports six passing controls and the source mode. Rejection leaves an existing destination unchanged. Stop the development server and clear the override to return to the fixture. `npm run start` ignores this override and always uses the approved tracked aggregate.

With the local export development server running, open another terminal at the repository root:

```powershell
.venv/Scripts/python.exe scripts/check_dashboard_api.py --base-url http://127.0.0.1:3000
```

Replace port 3000 with the actual printed server port. The script needs the matching local analytical database, compares the API snapshot identity with the analytical pointer, and checks six complete HTTP scenarios against independent read-only SQL controls and writes `output/dashboard/http-validation.json`. It is not a generic remote production probe. For a custom analytical output collection, pass `--analytics-root PATH`. The checker has no snapshot-root flag; it uses snapshot identity recorded in the analytical pointer. Keep the local analytical run and served export matched.

## Evidence, publication and limits

New runs record your revision, dirty state, dependencies, source identity and controls. They will not recreate the exact approved JSON full-file hash: timestamps, run IDs and revisions differ. Compare input fingerprints and logical content under the same contracts/source, then independently validate results. Never rewrite provenance or copy a fresh export over the pinned production file.

Historical executed results are in [Issue #4](issue-4-validation.md), [Issue #5](issue-5-validation.md), [Issue #6](issue-6-validation.md), [Issue #7](issue-7-validation.md), and the [aggregate artifact review](dashboard-artifact-review.md). They are not evidence that these commands were rerun on your checkout. CI runs offline fixture gates without SQL Server, credentials or sample downloads; source/hosted validation requires separately identified evidence.

The [redistribution assessment](data-redistribution.md) remains conditional. The original backup URL/hash and independent asset-level licensing grant remain unverified. Retained numeric sample IDs are linkable, not anonymized. The approved aggregate exception is not blanket authorization for raw backups, Parquet, databases or replacement exports. Microsoft's notice does not license this project's original code; no repository-wide code license has been selected. Do not add one as part of reproduction.

There is no automatic refresh, production orchestration, live-data freshness, recognized-revenue interpretation, ROI claim or hosted concurrency guarantee. Publication and issue closure require their own explicit approvals.
