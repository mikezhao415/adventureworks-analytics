# AdventureWorks Analytics

An end-to-end **BI-as-Code analytics engineering portfolio project** demonstrating reproducible data ingestion, dimensional modeling, automated quality assurance, and business intelligence delivery using **AdventureWorks 2022**.

The goal is to **build and demonstrate a modern analytical implementation**, not to benchmark it against a traditional reporting approach. Correctness, version control, maintainability, reproducibility, and useful business metrics are the central themes.

> **Current status:** The synthetic vertical slice and AdventureWorks extraction are merged and validated ([PR #2](https://github.com/mikezhao415/adventureworks-analytics/pull/2), [PR #10](https://github.com/mikezhao415/adventureworks-analytics/pull/10)). Real-source dimensional models and sales marts are merged in [PR #11](https://github.com/mikezhao415/adventureworks-analytics/pull/11); see the [snapshot-to-mart guide](docs/dimensional-modeling.md). The sales dashboard was completed and squash-merged in [PR #13](https://github.com/mikezhao415/adventureworks-analytics/pull/13), closing [Issue #7](https://github.com/mikezhao415/adventureworks-analytics/issues/7). The public dashboard is live at https://adventureworks-analytics-flax.vercel.app/; the separate business/technical case study and complete reproducibility guide remain pending ([Issue #8](https://github.com/mikezhao415/adventureworks-analytics/issues/8)).

## What this project demonstrates

- **Ingestion:** Repeatable, read-only extraction from SQL Server to fingerprinted Parquet snapshots.
- **Modeling:** Version-controlled DuckDB and dbt staging, facts, dimensions, and business-ready marts.
- **Quality:** Independent source reconciliation, data contracts, referential checks, regression tests, and fail-closed publication.
- **Automation:** Repeatable local execution and appropriately scoped GitHub Actions validation.
- **Business intelligence:** Useful sales KPIs, trends, and customer, product, and regional reporting.
- **Communication:** A reproducible technical implementation and accessible business-facing case study.

## Architecture

```text
AdventureWorks 2022 / SQL Server
          |
          | read-only, repeatable extraction (local/manual)
          v
  Validated Parquet snapshots + manifests
          |
          v
      DuckDB analytical layer
          |
          | dbt staging -> facts/dimensions -> marts
          v
  Tested, documented sales metrics
          |
          v
  Reviewed pinned aggregate export
          |
          v
  Public Next.js dashboard on Vercel

  Separate business/technical portfolio case study: pending
```

SQL Server ingestion publishes validated local Parquet snapshots. A separate real-source dbt project builds 23 staging, dimensional, fact and mart models with independent Python reconciliation. The synthetic mode retains its original smaller pipeline. The public Next.js dashboard serves only the reviewed, checked-in static aggregate; the SQL Server, Parquet, DuckDB and dbt pipeline is not hosted on Vercel. It consumes a reconciled versioned export; see the [dashboard guide](docs/sales-dashboard.md).

## Technology

| Component | Technology | Purpose |
| --- | --- | --- |
| Source | SQL Server 2022 + AdventureWorks 2022 | Existing local transactional sales database |
| Extraction | Python + Docker/sqlcmd with read-only credentials | Serializable source reads |
| Snapshots | Parquet and manifests | Validated, traceable local inputs |
| Analytical engine | DuckDB | Analytical storage and queries |
| Transformations | dbt Core + dbt-duckdb | SQL modeling, tests, and documentation |
| Validation | Python, SQL, dbt | Independent data and financial controls |
| Automation | GitHub Actions | Lightweight CI; optional local full-source validation |
| Reporting | Next.js / React / TypeScript / Tailwind CSS / Recharts | Responsive sales dashboard, typed API, and validated, URL-persistent filters |

## Execution modes

**Synthetic validation — implemented:** Deterministic orders and lines for two **simulated tenant labels** exercise composite-key correctness, decimal-safe financial reconciliation, dbt tests, and deliberate corruption checks. These labels are retained as a **test fixture only**; multi-tenant modeling and authorization are not project objectives. Synthetic CI needs no SQL Server, Docker, credentials, or external dataset.

**AdventureWorks ingestion and analytics — local/manual:** Extraction reads nine contracted tables from an existing SQL Server container and publishes independently validated snapshots; see [setup and limitations](docs/adventureworks-extraction.md). Analytics consumes an existing snapshot without SQL Server, builds typed DuckDB/dbt staging, six dimensions, two facts and six sales marts, and reconciles every model row independently from Parquet. See [metric contracts and reproduction](docs/dimensional-modeling.md). Lightweight CI runs small offline regressions and the existing synthetic slice; real-source integration evidence is separate.

From the repository root, after installing `requirements.lock` and creating a validated local snapshot:

```bash
python -m src.analytics
python -m src.analytics_check
```

## Explore the published dashboard

**Live:** https://adventureworks-analytics-flax.vercel.app/ — Microsoft's fictional historical AdventureWorks 2022 sample business data, not live or actual commercial results. The pinned static aggregate is published with Microsoft attribution; no SQL Server or analytics database is hosted on Vercel.

## Launch the local sales dashboard

Use Node.js 22 or newer. No SQL Server, credentials or private data are needed to run the checked-in web application locally:

```bash
cd apps/web
npm ci
npm run dev
```

Open the printed loopback URL. Sales Overview, Sales Trends, Products & Categories,
Customers, and Territory Performance each have dedicated views. The Filters page
supports inclusive custom start/end dates, territory/category multi-selects,
draft/apply/reset behavior, and URL state that persists across navigation, reloads,
and browser history. Category filters apply only to Products & Categories.
Data & Definitions explains metric rules, provenance, and interpretation. The UI
uses native AdventureWorks sample USD amounts for display, preserving exact
underlying decimal precision. See the [dashboard implementation and validation guide](docs/sales-dashboard.md).

The checked-in demo is explicitly **fictional**. Production instead serves the reviewed, pinned AdventureWorks 2022-derived aggregate artifact (PR #17, Issue #16 complete); the project-created fictional fixture remains for local development and tests. The Production release was explicitly approved and verified. Future releases require separate approval. See the [exact artifact review](docs/dashboard-artifact-review.md).
The dashboard was delivered by [PR #13](https://github.com/mikezhao415/adventureworks-analytics/pull/13),
with both Sales dashboard and BI quality/reproducibility workflows passing on the
final PR head. Quality automation was delivered in PR #12.

## Initial sales metric contracts

The [implemented metric contract](docs/dimensional-modeling.md#metric-contract) defines shipped-order eligibility, order counts, units, six-decimal net line sales, four-decimal header amounts and AOV, calendar months, and customer/product/category/order-territory groups. Facts preserve all statuses. Header money is never allocated to product lines; product/category order counts overlap and are not additive. Amounts retain source precision. Dashboard presentation uses the reviewed [native USD interpretation](docs/currency-interpretation.md), without FX conversion or a recognized-revenue claim.

## Roadmap

1. **Foundation and architecture — established; scope alignment in [#3](https://github.com/mikezhao415/adventureworks-analytics/issues/3).** Maintain project identity, reproducibility principles, architecture, and engineering guidance.
2. **Synthetic BI-as-Code proof of concept — complete ([#1](https://github.com/mikezhao415/adventureworks-analytics/issues/1), [PR #2](https://github.com/mikezhao415/adventureworks-analytics/pull/2)).** Validated fixtures, DuckDB/dbt models, reconciliation, negative tests, and CI.
3. **[AdventureWorks ingestion and snapshots — #4](https://github.com/mikezhao415/adventureworks-analytics/issues/4) — merged ([PR #10](https://github.com/mikezhao415/adventureworks-analytics/pull/10)).** Read-only SQL Server extraction, Parquet manifests, and independent controls.
4. **[Dimensional modeling and transformations — #5](https://github.com/mikezhao415/adventureworks-analytics/issues/5) — merged in PR #11.** Staging, facts, dimensions, sales marts, contracts, tests, and lineage.
5. **[Data quality and automation — #6](https://github.com/mikezhao415/adventureworks-analytics/issues/6).** Merged in PR #12: quality gates, regression coverage, repeatability, and evidence.
6. **[Business intelligence and analytics — #7](https://github.com/mikezhao415/adventureworks-analytics/issues/7) — complete (PR #13).** Validated local dashboard, versioned export, fictional public-safe demo, responsive views, documented metric definitions, and passing browser/CI checks.
7. **[Publication and reproducibility — #8](https://github.com/mikezhao415/adventureworks-analytics/issues/8) — next.** The public dashboard now serves the reviewed AdventureWorks sample aggregate (PR #17, Issue #16 completed). The two-audience case study and reproduction gates remain open.

Phases may overlap where practical, but each issue must state its own acceptance evidence. **Neither direct-query comparisons nor multi-tenant simulation is required.**

## Reproduce the implemented synthetic slice

Python 3.13 is required. From the repository root:

```bash
python -m venv .venv
# Activate the environment for your shell
python -m pip install -r requirements.lock
python -m src.quality_check
python src/run.py
```

See the [quality coverage and recovery guide](docs/quality-automation.md) for offline/real-source boundaries, evidence, dependency refresh and failure recovery.

See [docs/synthetic-slice.md](docs/synthetic-slice.md) for negative tests, evidence, and limitations. `requirements.txt` documents direct dependencies; `requirements.lock` pins the tested dependency resolution.

## Data provenance and licensing

AdventureWorks 2022 is a Microsoft SQL Server sample distributed through Microsoft's [official release](https://github.com/microsoft/sql-server-samples/releases/tag/adventureworks). Microsoft describes its SQL Server samples as [MIT-licensed](https://learn.microsoft.com/en-us/sql/samples/sql-samples-where-are); redistribution of covered materials requires retaining the [Microsoft copyright and permission notice](https://github.com/microsoft/sql-server-samples/blob/master/license.txt). See the [data provenance and redistribution policy](docs/data-redistribution.md) for the source evidence, attribution rules, and asset-specific caveat.

The hosted dashboard uses the **reviewed AdventureWorks 2022-derived aggregate export** with the Microsoft notice. The [Issue #16 artifact review](docs/dashboard-artifact-review.md) documents its scope and release. The original backup download URL/hash and independent asset-level license grant remain unverified; this is a conditional licensing assessment, not legal clearance. Do not commit database backups, raw source snapshots, generated DuckDB files, secrets, or unreviewed exports. Original project code licensing is a separate decision; the repository-wide license is **not yet selected**.

## Evidence and limitations

Published claims must identify the input source, revision, environment, metric definition, validation performed, and limitations. Do not present synthetic results as real AdventureWorks findings, claim a full-source run based on lightweight CI, or imply production security, performance, freshness, or ROI has been demonstrated.

## Development and portfolio

See [AGENTS.md](AGENTS.md) for implementation rules and quality gates. This repository is the independent technical evidence base for a public case study aimed at both business and technical readers. Do not include unrelated repositories, employer-specific infrastructure, customer information, or confidential details.
