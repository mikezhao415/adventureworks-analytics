# Issue #6 local validation

Validation date: October 19, 2026 (America/Los_Angeles). These are local Windows
results, not remote GitHub Actions results. The starting main revision was
`cfa40482084fb80c817c95fe93ef1e5af6911f98`; GitHub confirmed PRs #10 and #11 merged.
No source database access, configuration changes or new extraction were required.

## Executed checks

- Initial offline suite: 18 methods passed; subsequent evidence-runner suite:
  19 methods passed, including separate-process lock contention. Targeted final
  extraction suite: nine methods passed, including actual atomic replace failure.
- Synthetic pipeline: four models and twelve tests passed; repeated report bytes
  matched. Orphan, duplicate-order and wrong-subtotal each returned exit 42,
  named the expected failing dbt test, and published no report.
- Real existing AdventureWorks snapshot: two complete 23-model/97-test dbt builds,
  independent Python reconstruction of every model row and metric, all 23 logical
  content hashes and eligible totals matched. Five deliberate analytical
  corruptions were rejected by independent Python and their exact dbt test.
- `pip check` passed; installed `pip freeze --exclude-editable` exactly matched
  the non-comment lock entries. No dependency version changed.
- Whitespace and tracked generated-file checks passed. Reviewed changes contain
  no credentials, source records, datasets, database files or generated outputs.

The first synthetic attempt exposed PATH-dependent dbt lookup when invoking the
venv Python without activation. The runner now resolves dbt beside that Python;
the complete synthetic sequence subsequently passed.

## Evidence and input

Generated evidence remains ignored and local:

- `output/quality/tests.json`: offline method/subtest outcomes, revision/dirty
  state, environment and lock hash; fixture analytical and negative evidence are
  adjacent. Re-running the command replaces this suite's prior evidence.
- `output/issue6-synthetic/results.json`, logs, reports and selected dbt results:
  synthetic positive/repeatability and three expected rejections.
- `output/issue6-real/integration-evidence.json`: two real builds, input identity,
  model hashes, independent totals and five actual negative rejection reasons.
  Per-run `evidence.json` contains dbt status counts and provenance.
- `output/issue6-quality.log`, `issue6-extraction.log` and `issue6-real.log`:
  local execution logs.

The real run used snapshot `20261019T001836Z-ee2547d8e90749b68133c76a806f9e6f`,
input fingerprint
`97213a5b66b6cacb8229182a65442bf8bf66c6eb9430120f01afedb8ac5cfe89`.
Its existing manifest checksum, complete snapshot contracts, file checksums and
independent source controls were revalidated by each build. Shipped totals remained
31,465 orders, 274,914 units, net line sales 109846381.399888 and header subtotal
109846381.4039. This confirms the previously documented per-order rounding
difference, not a currency denomination or recognized-revenue interpretation.

Python 3.13.15, DuckDB 1.5.6, dbt Core 1.12.5, dbt-duckdb 1.11.0 and PyArrow
26.0.0 were used. Initial validation evidence records the base revision with
`working_tree_dirty=true`: those runs tested the in-progress changes and must not
be described as tests of unchanged main. Inspect each generated evidence file
for its actual revision/state, rather than inferring it from this document.

## CI and limitations

The updated single PR workflow runs exact dependency resolution, `pip check`,
the offline evidence suite and the preserved synthetic positive/repeat/negative
sequence. It uploads offline and synthetic evidence on success or failure. Real
snapshots and SQL Server are never needed by this job. Remote execution must be
verified on the draft PR; local results do not establish a remote CI pass.

See [coverage, reproduction and recovery](quality-automation.md) for the matrix,
commands and expected rejection mechanisms. There is no claim of abrupt-kill,
power-loss, network-filesystem or production concurrency guarantees. There was no
fresh-machine restore or dependency refresh, live SQL Server extraction/permission
rerun, dataset publication or dependency vulnerability audit. Licensing/provenance
requirements remain in force. Issue #6 remains open pending review and approval.
