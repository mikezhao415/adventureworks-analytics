# Issue #6 quality coverage and operation

This change extends the existing extraction and dimensional validation; it retains
both dbt projects, their independent controls, pinned dependencies and publication
layout. PRs #10 and #11 were confirmed merged through GitHub's API on October 19,
2026; the starting main revision was `cfa4048`.

## Coverage matrix

| Boundary | Existing safeguard | Gap / addition for #6 | Execution |
| --- | --- | --- | --- |
| Source contracts | Declared Arrow types; source metadata; null/key/count checks | Explicit missing/extra row column, integer type/nullability drift and lossy decimal rejection assertions | Offline CI |
| Source integrity | File checksum/size, schema, logical hash, table set, fingerprint | Explicit wrong input fingerprint rejection | Offline CI |
| Financial controls | Independent source counts, monthly/status totals, line equation, per-order header rounding | Retain existing positive and corruption cases without duplicating them | Offline CI; full snapshot local |
| Relationships | Composite offer/product FK and other source FKs, keys and dbt relationships | Retain orphan, duplicate and fan-out cases | Offline CI |
| Models and marts | 23 enforced schemas; 97 dbt tests; Python reconstruction of every row and grouped metric | Exact model/rejection assertions; explicitly corrupt canceled-order eligibility and require the selected financial dbt test to fail | Offline CI |
| Repeatability | Snapshot fingerprints, synthetic report equality, all model hashes and totals | Retain content comparisons; physical DuckDB bytes are not a reproducibility oracle | Offline CI and local full snapshot |
| Extraction publication | Exclusive local lock, staged validation, atomic pointer, failure records | Cooperative interruption diagnostics; separate-process held-lock rejection | Offline CI |
| Analytical publication | Staging, revalidated input, lock, atomic pointer; failed dbt and tampering regressions | Pointer replacement and finalization failures, cooperative interruption, lock contention; exact error categories and unchanged pointer | Offline CI |
| Evidence | Snapshot and analytical environment/revision/hash/control evidence | Label fixtures explicitly; retain per-test/subtest outcomes and fixture analytical evidence before temporary-directory cleanup | Offline CI and local |
| Synthetic invocation | dbt resolved from PATH | Resolve dbt beside the running Python so explicit venv commands work without shell activation | CI and local |
| Dependencies | Python 3.13, exact lock comparison, pip cache | `pip check`, explicit lock cache key; safe refresh procedure below | CI and local |
| Live source | Read-only account and independent SQL controls | No new SQL Server automation; existing integration command remains opt-in | Manual |

The fixture includes multiple statuses, two-line orders, nullable category/territory,
non-additive product order counts and halfway monetary rounding. Existing tests
also exercise no eligible orders. A separate staging schema mutation checks the independent schema validator. Negative tests require named `ValidationError`
messages or an injected exception type; targeted dbt cases inspect `run_results`
and require the exact selected test to have status `fail`, rather than accepting
an arbitrary process error. See `tests/test_extraction.py` and
`tests/test_analytics.py` for the scenario mutations and expected messages.

## Reproduction and evidence

From a clean checkout, use Python 3.13:

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.lock
.venv/Scripts/python.exe -m pip check
.venv/Scripts/python.exe -m src.quality_check
.venv/Scripts/python.exe src/run.py
```

On Linux use `.venv/bin/python`. The offline suite runs actual fixture dbt builds,
repeatability and targeted dbt tests. It needs no SQL Server, Docker, credentials,
source downloads or private data. Installing pinned packages requires package-index
access. The synthetic runner remains a separate CI positive/repeatability/negative
sequence. One job runs on every PR (no path exclusions), avoiding checks that can
be skipped by changes to fixtures, contracts, docs or dependency files. Pip caching
uses `requirements.lock`; no selective test scheduler or duplicate job is added.

`output/quality/tests.json` records local versus GitHub Actions execution context,
revision/dirty state, lock SHA-256, Python and dependency versions, method and
subtest results, counts and limitations. `offline-analytics.json` retains the
fixture input identity/fingerprint, dbt result counts, all 23 model hashes and
independently reconciled controls. `offline-negative.json` records six analytical
mutations, actual independent rejection messages and selected dbt test statuses.
These are offline fixture evidence even though
the model family is AdventureWorks. Existing snapshots without a validation-mode
field retain the historical real-source interpretation. A new suite removes its
previous success evidence before starting. A hard-killed suite can leave partial
fixture evidence without a completed test report; that is not a successful suite.
CI uploads quality and synthetic evidence with `if: always()` for seven days.
A passing fixture build alone does not mean that all regression tests passed;
read the suite report and the GitHub job conclusion as well.

For an **existing local snapshot**, without database access:

```powershell
.venv/Scripts/python.exe -m src.extract --validate output/adventureworks/SNAPSHOT_ID
.venv/Scripts/python.exe -m src.analytics_check --output-root output/issue6-real
```

The check performs two builds, independent reconciliation of every model and
logical content comparison, then five existing targeted corruptions on local
copies. `output/issue6-real/integration-evidence.json` references the full-source
snapshot, revision, environment, controls and rejection reasons. No datasets or
raw generated artifacts are committed. Real extraction/permission checks remain
manual via `python -m src.integration_check`; see the extraction guide. The #6
snapshot checks do not establish fresh extraction or SQL Server account behavior.

## Failure recovery and filesystem limits

Both boundaries serialize cooperative publishers with exclusive `.publish.lock`
creation. Lock contention is rejected; no wait or automatic stale-lock stealing
occurs. Pointer replacement is atomic on the supported local filesystem. Tests
cover held-lock rejection (including a separate process), injected finalization
and pointer failures, and cooperative `KeyboardInterrupt`. They do not prove
power-loss durability, network-filesystem atomicity, hostile writers, or all
possible process-termination timings.

1. Stop publishers and confirm that no process still owns the collection before
   touching a lock or staging directory. Never remove an active lock.
2. Read `current.json`, record the referenced run ID and verify its hashes plus
   snapshot validation (or analytical reconciliation) before recovery work.
3. Inspect `failure-RUN_ID.json` for extraction or `failed-RUN_ID/failure.json`
   and retained dbt logs/results for analytics. Failure records retain categories
   and identity, not exception text or credentials. Cooperative interrupts now
   retain these diagnostics and release the lock. Abrupt termination can instead
   leave `.staging-RUN_ID`, a stale lock, or a completed unreferenced run.
4. Only after confirming abandonment, remove that specific `.staging-RUN_ID` and
   stale lock. Inspect unexpected temporary JSON files as abandoned work; do not
   use broad wildcard deletion. Preserve diagnostics as needed. Never remove a
   directory referenced by `current.json` or rewrite a published artifact.
5. Re-run normally. A finalized run whose pointer replacement failed is an
   unreferenced candidate, not the current result. Leave it for diagnosis or
   validate it separately; do not promote it by guessing pointer contents.

Handled failures remove invalid staged databases and preserve the previous
pointer. A failure after finalization can leave a complete unreferenced run.
Old valid published runs are retained; cleanup/retention remains a manual choice.
The original synthetic runner intentionally removes its report on rejected inputs;
it has no immutable-run/current-pointer protocol. This change preserves that
existing synthetic behavior.

## Dependency refresh and hygiene

Keep the working environment intact. Create a separate Python 3.13 venv, review
changes to direct pins in `requirements.txt`, resolve them there, and review the
complete freeze diff before replacing `requirements.lock`. Recreate a second
fresh environment from that lock; run `pip check`, exact freeze comparison, the
quality suite, synthetic sequence and (when available) real snapshot validation.
Review package licenses and vulnerability notices before approving the refresh.
Do not install upgrades into the known-good environment or infer compatibility
from successful resolution alone. This issue upgrades no dependencies.

Before committing, run `git diff --check`, inspect `git diff --cached`, and check
`git ls-files` for `.env`, credentials, backups, Parquet, DuckDB, generated output
and dbt artifacts. `.gitignore` excludes them; it is not a secret scanner. Do not
print credential files while reviewing. Dataset redistribution provenance and
the unselected repository license remain documented limitations; no dataset is
published by this change.

Actual #6 execution results are in [issue-6-validation.md](issue-6-validation.md).
Remote CI evidence must be assessed on the PR separately from local results.

## Current publication boundary

The checks and evidence above describe pipeline validation, not deployment authorization. PR #17 subsequently published one reviewed, pinned AdventureWorks aggregate; other generated outputs remain ignored. Follow [reproducibility](reproducibility.md) for dashboard-only and full-pipeline paths. The [redistribution policy](data-redistribution.md) retains the original backup URL/hash and independent asset-level license limitations; offline quality success does not resolve them.
