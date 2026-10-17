# AdventureWorks Analytics

A reproducible analytics engineering project exploring how transactional sales data can be transformed into trustworthy, version-controlled analytical datasets.

The project uses **AdventureWorks 2022** as a representative transactional source and will develop a read-only extraction workflow, validated snapshots, a DuckDB analytical layer, dbt models, and measurable reporting experiments. The emphasis is on **data correctness, reproducibility, explainable trade-offs, and clear business metrics**.

> **Project status: Initial implementation in progress.** A synthetic vertical slice is being developed; it must pass CI and review before being treated as validated. The full AdventureWorks extraction, benchmarks, and production capabilities are not implemented.

## Questions this project explores

- How can transactional sales records become consistent, documented business metrics?
- How do automated tests and independent reconciliation prevent incorrect reports?
- What changes when reporting queries use an analytical layer instead of querying a transactional system directly?
- How can tenant-scoped reporting and cross-tenant aggregation be simulated safely and evaluated?
- What are the measurable costs, freshness constraints, and operational trade-offs of this design?

## Planned architecture

```text
AdventureWorks 2022 / SQL Server (transactional source)
             |
             | read-only, repeatable extraction
             v
     Immutable Parquet snapshots
             |
             | manifests + source reconciliation
             v
       DuckDB analytical store
             |
             | dbt: staging -> facts/dimensions -> marts
             v
   Tested business metrics and reports
             |
             | independent validation + evidence
             v
       Documented experiments
```

**Source isolation:** The analytical layer is separate from the transactional source. The project will measure, rather than assume, differences in workload and performance. Snapshot-based reporting has a freshness trade-off.

## Planned technology

| Component | Choice | Purpose |
| --- | --- | --- |
| Transactional source | SQL Server 2022 + AdventureWorks 2022 | Representative relational OLTP dataset |
| Extraction | Python, read-only database account | Repeatable bounded source reads |
| Snapshot format | Parquet + manifest | Portable, auditable input |
| Analytical engine | DuckDB | Local analytical querying |
| Transformations | dbt Core + dbt-duckdb | Version-controlled models and tests |
| Quality checks | SQL/dbt + independent Python | Integrity and financial reconciliation |
| Automation | GitHub Actions | Lightweight automated gates |
| Reproduction | Local optional SQL Server/Docker setup | Full source-to-output demonstration |

Versions will be pinned when the implementation is introduced.

## Execution modes (planned)

**Lightweight validation:** Deterministic synthetic fixtures exercise models, reconciliation, and failure paths in CI. It must not require SQL Server, Docker, external credentials, or large data downloads.

**Full reproduction:** An opt-in local or manually triggered workflow starts from a legitimately obtained AdventureWorks database, extracts source data, produces snapshots, and validates analytical outputs. Full-source results must not be represented as covered by lightweight CI.

## Metric contracts (initial proposal)

The first domain is **sales**. Before implementing models, document exact source fields, grain, filters, and calculation rules for:

- Order count: distinct sales order identifiers at the intended scope.
- Units sold: sum of eligible order-line quantities.
- Line sales: sum of eligible line amounts, with decimal precision preserved.
- Monthly sales: defined calendar-month aggregation and explicit date/time convention.
- Order totals: distinguish line subtotal, tax, freight, and total due; never silently treat these as interchangeable.

Returns, cancellations, currency assumptions, and null-handling must be defined from the source schema before publishing metrics. Any synthetic multi-tenant extension must be explicitly labeled as simulated and must not be mistaken for a native AdventureWorks feature.

## Validation philosophy

Each dataset and model must have a declared grain and key. Planned controls include uniqueness, non-null and relationship checks, source-to-snapshot counts, financial reconciliation with explicit tolerances, and negative tests that prove invalid input is rejected. A failed build must not publish a successful report or replace a known-good snapshot. Evidence must identify its source mode, code revision, input fingerprint, test results, and limitations.

## Roadmap

1. **Foundation:** Define project scope, contribution rules, source/license review, architecture, and acceptance criteria.
2. **Synthetic vertical slice:** Implement deterministic fixtures, DuckDB loading, dbt models, reconciliation, and negative-case CI.
3. **AdventureWorks extraction:** Add opt-in SQL Server setup, read-only extraction, Parquet snapshots, and independent source checks.
4. **Analytics model expansion:** Formalize sales facts, dimensions, marts, tests, and documentation.
5. **Comparative experiments:** Establish fair direct-query versus analytical-query measurements, including query timing, source load, and freshness.
6. **Multi-tenant simulation:** Introduce documented synthetic tenant assignments, isolation tests, and controlled aggregate reporting.
7. **Publication:** Present methodology, evidence, results, limitations, and business/technical explanations.

These are planned phases, not completion claims. Each phase should ship through a focused pull request with its own acceptance tests.

## Reproducing the work

The initial synthetic execution instructions are in [docs/synthetic-slice.md](docs/synthetic-slice.md). They require Python 3.13 and the pinned packages in requirements.txt. Full AdventureWorks reproduction remains a separate future milestone. Avoid interpreting a passing synthetic test as proof that the SQL Server extraction path works.

## Data provenance and licensing

AdventureWorks is a Microsoft sample database. Before adding downloads, dataset files, or derived data to this repository, verify the applicable license and redistribution terms for the exact source and artifacts. Prefer documented acquisition instructions to committing a database backup. Do not commit proprietary datasets, secrets, connection strings with credentials, or personal information. Generated snapshots, database files, compiled dbt outputs, and reports are not automatically appropriate for version control.

## Evidence and limitations

Every published experiment should include the question, hypotheses, hardware/software environment, dataset and sample size, query definitions, warm-up and run protocol, measured outputs, repeatability notes, and limitations. No claim of production performance, security enforcement, equal freshness, ROI, or causal superiority is warranted without a study designed to support it.

## Development and contribution

See [AGENTS.md](AGENTS.md) for repository conventions, quality gates, agent operating rules, and phased implementation guidance. Until a contribution guide and automated checks are added, propose changes through small, reviewable pull requests and document validation performed.

## Portfolio context

This repository is the technical implementation and evidence base for a broader analytics engineering case study. Public explanations should be understandable to both technical readers and business stakeholders, without disclosing any employer-specific systems, customers, or internal information.

## License

**To be decided.** No repository-wide license is granted by this README. Review code licensing and dataset licensing separately before selecting a license or redistributing artifacts.
