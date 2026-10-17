# Synthetic vertical slice

This is the first functional milestone for AdventureWorks Analytics. All records are **deterministic synthetic fixtures**, not AdventureWorks data.

## Quick start

Requires Python 3.13. From the repository root:

```bash
python -m venv .venv
# Activate .venv in your shell
python -m pip install -r requirements.lock
python -m unittest discover -s tests -v
python src/run.py
```

The runner creates `output/slice.duckdb` and publishes `output/report.json` only after a successful dbt build and an independent Python reconciliation. The report contains `mode`, `seed`, `source_orders`, `source_lines`, `totals`, and `monthly` fields. Published values are read from the validated **DuckDB monthly mart**, not copied from the fixture's expected controls. Publication uses a temporary file and atomic rename.

To verify negative cases, run each command separately:

```bash
python src/run.py --inject orphan
python src/run.py --inject duplicate-order
python src/run.py --inject wrong-subtotal
```

Each expected rejection exits with **42**, names the failing dbt test, and leaves no published `output/report.json`. Any different exit status indicates a defect. These scenarios respectively target `no_orphans`, `unique_order_keys`, and `reconcile_headers`. The negative runner first builds models, then executes **only** the named test to avoid mistaking unrelated failures for the expected rejection. The ordinary positive run executes the entire dbt build/test suite.

## Data and metric contracts

The fixture creates 50 orders per simulated tenant (100 total), across January–March 2025. Order and line identifiers intentionally repeat across tenants; joins and uniqueness checks must use composite tenant-scoped keys. Order lines have integer quantities and decimal sales amounts; synthetic tax is 8% of the subtotal (rounded to cents), with fixed $2.50 freight per order. `net_sales` is line sales **excluding** tax and freight. The month is the first day of the month of the date-only order date. No returns, cancellations, exchange rates, or production tenant authorization are modeled.

The Python fixture calculates independent per-tenant/month control totals. The dbt monthly reconciliation separately reads raw tables rather than relying on staging views as its oracle. Python compares actual mart rows to expected controls and fails closed on discrepancies. This provides meaningful independent checks but is not an external financial audit.

## CI and evidence

GitHub Actions runs unit tests, the positive dbt pipeline, deterministic report comparison, and three negative scenarios. It uploads the successful report, **positive** dbt results, each targeted negative result, and the resolved dependency list. The committed `requirements.lock` pins the full Python 3.13 dependency resolution observed in CI, and CI verifies the installed package versions match it. `requirements.txt` records direct dependencies. The lock is version-pinned but not hash-locked; refresh it intentionally when upgrading dependencies.

## Limitations

This is a small synthetic pipeline. It does not demonstrate SQL Server extraction, production performance, data access controls, freshness guarantees, or ROI. Full AdventureWorks reproduction is a separate milestone.
