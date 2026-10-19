# AdventureWorks Analytics

An end-to-end **BI-as-Code analytics engineering portfolio project** demonstrating reproducible data ingestion, dimensional modeling, automated quality assurance, and business intelligence delivery using **AdventureWorks 2022**.

The goal is to **build and demonstrate a modern analytical implementation**, not to benchmark it against a traditional reporting approach. Correctness, version control, maintainability, reproducibility, and useful business metrics are the central themes.

> **Current status:** The synthetic vertical slice and AdventureWorks extraction are merged and validated ([PR #2](https://github.com/mikezhao415/adventureworks-analytics/pull/2), [PR #10](https://github.com/mikezhao415/adventureworks-analytics/pull/10)). Real-source dimensional models and sales marts are merged in [PR #11](https://github.com/mikezhao415/adventureworks-analytics/pull/11); see the [snapshot-to-mart guide](docs/dimensional-modeling.md). Dashboards and the public case study remain future work.

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
  Business intelligence reports / dashboards
          |
          v
  Public BI-as-Code case study
```

SQL Server ingestion publishes validated local Parquet snapshots. A separate real-source dbt project builds 23 staging, dimensional, fact and mart models with independent Python reconciliation. The synthetic mode retains its original smaller pipeline. Dashboard delivery remains **planned**.

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
| Reporting | To be selected | Business-ready dashboard and insights |

## Execution modes

**Synthetic validation — implemented:** Deterministic orders and lines for two **simulated tenant labels** exercise composite-key correctness, decimal-safe financial reconciliation, dbt tests, and deliberate corruption checks. These labels are retained as a **test fixture only**; multi-tenant modeling and authorization are not project objectives. Synthetic CI needs no SQL Server, Docker, credentials, or external dataset.

**AdventureWorks ingestion and analytics — local/manual:** Extraction reads nine contracted tables from an existing SQL Server container and publishes independently validated snapshots; see [setup and limitations](docs/adventureworks-extraction.md). Analytics consumes an existing snapshot without SQL Server, builds typed DuckDB/dbt staging, six dimensions, two facts and six sales marts, and reconciles every model row independently from Parquet. See [metric contracts and reproduction](docs/dimensional-modeling.md). Lightweight CI runs small offline regressions and the existing synthetic slice; real-source integration evidence is separate.

From the repository root, after installing `requirements.lock` and creating a validated local snapshot:

```bash
python -m src.analytics
python -m src.analytics_check
```

## Initial sales metric contracts

The [implemented metric contract](docs/dimensional-modeling.md#metric-contract) defines shipped-order eligibility, order counts, units, six-decimal net line sales, four-decimal header amounts and AOV, calendar months, and customer/product/category/order-territory groups. Facts preserve all statuses. Header money is never allocated to product lines; product/category order counts overlap and are not additive. Amounts retain source monetary units without currency conversion or a recognized-revenue claim.

## Roadmap

1. **Foundation and architecture — established; scope alignment in [#3](https://github.com/mikezhao415/adventureworks-analytics/issues/3).** Maintain project identity, reproducibility principles, architecture, and engineering guidance.
2. **Synthetic BI-as-Code proof of concept — complete ([#1](https://github.com/mikezhao415/adventureworks-analytics/issues/1), [PR #2](https://github.com/mikezhao415/adventureworks-analytics/pull/2)).** Validated fixtures, DuckDB/dbt models, reconciliation, negative tests, and CI.
3. **[AdventureWorks ingestion and snapshots — #4](https://github.com/mikezhao415/adventureworks-analytics/issues/4) — merged ([PR #10](https://github.com/mikezhao415/adventureworks-analytics/pull/10)).** Read-only SQL Server extraction, Parquet manifests, and independent controls.
4. **[Dimensional modeling and transformations — #5](https://github.com/mikezhao415/adventureworks-analytics/issues/5) — merged in PR #11.** Staging, facts, dimensions, sales marts, contracts, tests, and lineage.
5. **[Data quality and automation — #6](https://github.com/mikezhao415/adventureworks-analytics/issues/6).** Expand quality gates, regression coverage, repeatability, and evidence.
6. **[Business intelligence and analytics — #7](https://github.com/mikezhao415/adventureworks-analytics/issues/7).** Deliver validated sales reporting and insights.
7. **[Publication and reproducibility — #8](https://github.com/mikezhao415/adventureworks-analytics/issues/8).** Technical and business reading paths, public evidence, and portfolio integration.

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

AdventureWorks is a Microsoft sample database. Verify applicable licensing and redistribution terms for the exact files and derived artifacts before publishing them. Prefer documented acquisition over committing a database backup. Never commit secrets, sensitive records, large snapshots, generated DuckDB files, or unreviewed output artifacts. Code licensing and data licensing are separate decisions; the repository-wide license is **not yet selected**.

## Evidence and limitations

Published claims must identify the input source, revision, environment, metric definition, validation performed, and limitations. Do not present synthetic results as real AdventureWorks findings, claim a full-source run based on lightweight CI, or imply production security, performance, freshness, or ROI has been demonstrated.

## Development and portfolio

See [AGENTS.md](AGENTS.md) for implementation rules and quality gates. This repository is the independent technical evidence base for a public case study aimed at both business and technical readers. Do not include unrelated repositories, employer-specific infrastructure, customer information, or confidential details.
