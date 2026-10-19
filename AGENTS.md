# AGENTS.md — AdventureWorks Analytics

## Mission and project identity

Build a **standalone, publicly reproducible end-to-end BI-as-Code portfolio project** using AdventureWorks 2022. Demonstrate modern ingestion, dimensional modeling, automated data quality, business intelligence delivery, and clear communication of business metrics. The goal is to **implement the modern approach**, not to compare it against a traditional reporting architecture.

Do not reference unrelated repositories, employer systems, proprietary schemas, customers, or internal infrastructure in public code, documentation, issues, commits, or pull requests. Do not invent project history or imply planned capabilities are implemented.

## Sources of truth and status

- README.md describes public intent, roadmap, and reproduction instructions.
- AGENTS.md defines engineering and agent behavior.
- Code, tests, CI, and observed logs establish what is implemented and validated.
- Issues and plans are proposals until acceptance evidence exists.
- Keep status accurate: the synthetic vertical slice and Issue #4 extraction are merged and validated. Issue #5 dimensional models and local sales marts are merged in PR #11. Issue #6 quality automation remains under review until validation and merge approval. Dashboards and publication remain future work.
- Synthetic fixtures use two tenant labels solely to exercise scoped composite keys. **Do not expand multi-tenant simulation into a required project deliverable.**
- **Do not add legacy-vs-modern benchmarks or direct transactional-query comparisons** without an explicit change of scope.

## Stack and architecture

Python; SQL Server 2022 / AdventureWorks 2022 for optional local source reproduction; read-only extraction; Parquet with manifests; DuckDB; dbt Core + dbt-duckdb; independent SQL/Python validation; GitHub Actions. Choose dashboard technology when reporting requirements are concrete. Avoid unnecessary cloud services, paid platforms, speculative abstractions, and frameworks.

Planned full-source path:
1. Read AdventureWorks with least-privilege, read-only access.
2. Publish immutable, validated Parquet snapshots and source manifests.
3. Ingest snapshots into DuckDB with declared schemas.
4. Build dbt staging, fact/dimension, and sales mart models.
5. Reconcile metrics independently; run data-quality and regression gates.
6. Deliver business-ready sales reporting and insights.
7. Publish reproducible technical and business case-study materials.

Routine CI must not require SQL Server, Docker, credentials, external downloads, or large datasets. Full-source reproduction remains local/manual until explicitly implemented and validated.

## Delivery roadmap

- **Foundation / alignment — [#3](https://github.com/mikezhao415/adventureworks-analytics/issues/3):** Public scope, architecture, guidance, provenance, and status.
- **Synthetic proof of concept — [#1](https://github.com/mikezhao415/adventureworks-analytics/issues/1), PR #2 (complete):** Deterministic fixtures, DuckDB/dbt, reconciliation, negative tests, CI.
- **AdventureWorks extraction — [#4](https://github.com/mikezhao415/adventureworks-analytics/issues/4):** SQL Server, read-only extraction, Parquet snapshots, manifest and reconciliation.
- **Dimensional modeling — [#5](https://github.com/mikezhao415/adventureworks-analytics/issues/5):** Sales facts, dimensions, marts, metric contracts, tests, and lineage.
- **Quality and automation — [#6](https://github.com/mikezhao415/adventureworks-analytics/issues/6):** Expanded validation, regression coverage, evidence, and CI.
- **Business intelligence — [#7](https://github.com/mikezhao415/adventureworks-analytics/issues/7):** Useful sales dashboards and insights.
- **Publication — [#8](https://github.com/mikezhao415/adventureworks-analytics/issues/8):** Reproduction guide and business/technical portfolio narrative.

Ship each issue through focused, reviewable PRs with explicit acceptance tests. Never conflate a successful synthetic run with a full-source implementation.

## Proposed repository structure (only create when needed)

```text
.github/workflows/  # lightweight CI, optional manual full-source validation
config/             # safe non-secret configuration examples
dbt/                # sources, staging, dimensions, facts, marts, tests
docs/               # architecture, contracts, provenance, evidence, case study
src/                # extraction, snapshotting, validation, orchestration
tests/              # deterministic fixtures and regression tests
README.md
AGENTS.md
```

## Metric and data contracts

- Declare grain, keys, source lineage, eligibility, and cardinality for every model.
- Prevent header/line fan-out and double counting.
- Define the calendar and date/time convention for reporting.
- Distinguish line amount, subtotal, tax, freight, and total due.
- Use decimal-safe arithmetic, explicit rounding, and justified tolerances.
- Define statuses, returns, nulls, and relevant product/customer/territory dimensions using AdventureWorks semantics.
- Compare independent source controls with snapshots and marts; do not validate a transformation only against itself.
- Synthetic tenant labels remain a legacy fixture for test coverage, **not a product or reporting requirement**.

## Quality gates

For functional PRs, add appropriate:
1. Deterministic fixtures and repeatability tests.
2. Schema, uniqueness, not-null, relationship, and grain checks.
3. Source-to-snapshot and snapshot-to-mart reconciliation.
4. Specific negative-path tests that reject deliberate corruption for the expected reason.
5. Fail-closed publication: invalid inputs never replace known-good results.
6. Credential, licensing, generated-file, and dataset-leak review.
7. CI, dbt, Python, lint/type checks where configured, and documented reproduction commands.

Preserve machine-readable evidence with source mode, code revision, input fingerprint, environment, results, and limitations. Do not invent test outcomes or dashboard values.

## Security, licensing, and public claims

Use least-privilege read-only database credentials and ignored local environment variables or approved secret stores. Never commit secrets, backups, large Parquet outputs, or non-redistributable data. Verify AdventureWorks redistribution terms before publishing source or derived datasets. Review dependency and code licenses independently.

Explain the **implemented** analytical solution and its business outputs without unsupported superiority, performance, production-readiness, security, freshness, or ROI claims. Optimization within the modern stack may be measured if useful; comparative legacy benchmarking is out of scope.

## Agent workflow

1. Read README, AGENTS, relevant docs, code, and current GitHub issue/PR context.
2. Define the smallest deliverable and acceptance criteria.
3. Work on a feature branch; never force-push, delete branches, merge, or change settings without explicit approval.
4. Update tests and documentation alongside implementation.
5. Execute available checks and inspect evidence; clearly distinguish executed and unexecuted validation.
6. Review for confidential material, generated artifacts, licensing, scope creep, and unsupported claims.
7. Summarize changes, tests, limitations, and follow-ups in the PR.
8. Do not merge or declare an issue done until required checks pass and the user approves.

## Definition of done

An issue is complete when scoped acceptance criteria are implemented, actual validation evidence is available, reproducibility is documented, public claims are accurate, and the user approves the merge. Publication must serve both technical readers and business stakeholders without relying on private context.
