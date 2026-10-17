# AGENTS.md — AdventureWorks Analytics

## Mission and project identity

Build a **standalone, publicly reproducible analytics engineering case study** using AdventureWorks 2022 to explore transactional-to-analytical modernization. Favor credible engineering evidence over feature breadth. Treat this repository as a project beginning from its own stated requirements.

Do not reference unrelated repositories, employer systems, proprietary schemas, customers, or internal infrastructure in public code, documentation, issues, commits, or pull requests. Do not copy confidential material into this project. Do not invent a project history or imply capabilities exist before they are implemented.

## Source of truth and status discipline

- README.md describes public intent, scope, and user-facing reproduction instructions.
- AGENTS.md defines engineering and agent behavior.
- Executable code, tests, CI configuration, and observed logs establish implementation status.
- Design documents and plans are **proposals** until implemented and validated.
- Keep README, documentation, and tests synchronized with changes; do not mark a phase complete based solely on a PR description.
- State precisely what was executed, where, and with which inputs. Never claim tests passed without evidence.
- Never claim synthetic evidence proves full-source extraction, production performance, tenant authorization, or real-world ROI.

## Scope and architecture boundaries

Initial stack: Python, SQL Server 2022 / AdventureWorks 2022 (optional full reproduction), Parquet, DuckDB, dbt Core with dbt-duckdb, and GitHub Actions. Pin exact dependency versions when implementing. Avoid cloud platforms, orchestration frameworks, web apps, and paid services unless a specific experiment requires them and the scope is approved.

Proposed pipeline:
1. Read-only extraction from transactional tables.
2. Immutable, fingerprinted Parquet snapshot with a manifest and validation.
3. DuckDB ingestion with explicit source and schema contracts.
4. dbt staging, fact/dimension, and mart models with declared grain.
5. Independent reconciliation and failure-safe publication of analytical results.
6. Measured, reproducible reporting experiments.

Do not connect CI to an external production database. Do not require Docker or SQL Server for ordinary PR validation. Avoid committing raw database backups, large Parquet datasets, credentials, generated DuckDB files, or build artifacts.

## Implementation sequence

**Phase A — Foundation:** README, AGENTS.md, license/provenance decision, architecture/metric contracts, repository hygiene, and planned CI.

**Phase B — Lightweight vertical slice:** Deterministic synthetic orders and lines; tenant labels explicitly simulated; Python loader; DuckDB; minimal dbt staging, fact, and monthly mart; independent Python controls; both success and deliberate-corruption tests.

**Phase C — Full-source extraction:** Document optional SQL Server setup and AdventureWorks acquisition; use read-only credentials; snapshot headers/details and required dimensions; manifests, checksums, row counts, orphan/duplicate checks, financial controls, and replay instructions.

**Phase D — Analytical modeling:** Explicit business definitions, source grain, surrogate/composite keys where justified, referential tests, model contracts, and lineage documentation.

**Phase E — Controlled comparisons:** Same business question across transactional and analytical approaches; measured source cost, latency, resource utilization where measurable, data freshness, and experimental caveats.

**Phase F — Tenant simulation and publication:** Deterministic synthetic assignments; scoped results and explicit authorization limitations; controlled aggregate metrics; published evidence and dual-audience narrative.

Deliver phases in small PRs; do not combine future phases merely to fill an empty repository.

## Proposed structure (create directories only as needed)

```text
.github/workflows/  # lightweight CI and optional manual full validation
config/             # non-secret configuration and examples
dbt/                # dbt project, models, sources, schema tests, singular tests
docs/               # architecture, data contracts, methodology, evidence
experiments/        # benchmark definitions and controlled experiment runners
src/                # extraction, snapshots, validation, orchestration
tests/              # deterministic Python fixtures and regression tests
README.md
AGENTS.md
pyproject.toml      # when Python package tooling is introduced
```

Prefer straightforward, explicit modules. Avoid speculative abstractions and unnecessary dependencies.

## Data contracts and financial correctness

- Document every source's grain, primary/composite key, and expected cardinality.
- Orders and lines have different grains; prevent fan-out and accidental double counting.
- Define which date drives monthly aggregation and its timezone/calendar convention.
- Distinguish line amount, order subtotal, tax, freight, and total due.
- Use decimal-safe arithmetic for monetary calculations and explicit rounding/tolerance rules.
- Define eligibility of statuses, returns, and missing data before finalizing KPIs.
- If adding tenant identifiers, document them as a **synthetic modeling construct** and test that scopes cannot leak across tenants; do not claim SQL filters alone enforce access control.
- Validate source counts and totals independently of the transformation under test; never simply compare a query to itself.

## Quality gates

For each meaningful functional PR, add tests appropriate to its scope:

1. Deterministic fixture creation and repeatability.
2. Schema, non-null, uniqueness, and relationship checks at correct grains.
3. Source-to-snapshot and source-to-mart reconciliation with documented numeric tolerances.
4. Negative-path tests with *specific expected failures*, not merely any nonzero exit.
5. Ensure invalid inputs do not overwrite/publish successful results.
6. No secrets, large datasets, or generated outputs committed.
7. Lint, type checks where configured, unit tests, dbt parse/build where relevant, and reproducible commands.

Use a lightweight, network-independent CI path for routine PRs. Reserve SQL Server/Docker and large-source validations for optional/manual workflows. A passing CI job must accurately identify which mode it exercised.

## Benchmark discipline

Pre-register the question, hypothesis, source/data size, query equivalence, hardware/OS/software versions, cache/warm-up protocol, run count, and measurement methods. Report distributions rather than a single fastest run. Separate source load, analytical query time, extract/refresh cost, and freshness. Do not infer causal superiority or ROI from a small synthetic demonstration. Preserve scripts and machine-readable evidence where licensing and repository-size constraints permit.

## Security, provenance, and publication

- Use least-privilege read-only database credentials for extraction.
- Load secrets only from ignored local environment variables or approved secret stores.
- Never commit credentials, database backups, sensitive identifiers, or non-redistributable content.
- Verify Microsoft AdventureWorks licensing for the specific source and any derived redistribution; document the finding before distributing data.
- Review generated files and dependency licenses before publication.
- Keep public prose free of employer-specific context or claims.
- Do not invent benchmark results, test outputs, issue links, or validation status.

## Agent workflow

1. Read README.md, AGENTS.md, relevant docs, code, and current GitHub issue/PR context before editing.
2. Identify the smallest deliverable and explicit acceptance criteria.
3. Make focused changes on a feature branch. Never force-push, delete branches, merge, or alter repository settings without explicit authorization.
4. Implement tests alongside behavior; update relevant docs in the same PR.
5. Run the available validation commands and inspect failures, not just exit statuses.
6. Review the diff for secrets, generated files, dataset licensing, scope creep, and unsupported claims.
7. Summarize changes, exact tests run/results, limitations, and follow-ups in the PR.
8. Do not mark work complete or merge until required gates pass and the user approves.

When repository tooling does not yet exist, say so instead of fabricating commands. Prefer a plan and small implementation PR over premature scaffolding.

## Definition of done

A phase is done only when its scoped acceptance criteria are implemented, tests and reproducibility steps are documented, actual validations pass, public documentation accurately reflects the result, and the user has approved the merge. An experiment's conclusion must include limitations and remaining unknowns.

## Writing and presentation

Write for two audiences: a concise business explanation of the decision and outcome, plus a technically precise methodology. Use neutral language: **planned**, **implemented**, **tested**, **measured**. Avoid marketing claims, unverified performance promises, and confidential enterprise details. The project should stand on its own as an original public case study.
