# Synthetic vertical slice

This is the **first implementation milestone** for AdventureWorks Analytics. It uses deterministic synthetic records, **not** AdventureWorks data.

## Quick start

Requires Python 3.13.

```bash
python -m venv .venv
# Activate the virtual environment for your shell
python -m pip install -r requirements.txt
python src/run.py
```

The runner creates `output/slice.duckdb` and `output/report.json`. It creates 50 orders per simulated tenant (100 total) and reconciles monthly order counts, quantities, and line sales against controls computed independently from the fixture generator. The report is JSON with `mode`, `seed`, `source_orders`, `source_lines`, `totals`, and `monthly` fields.

Run the intentional corruption test:

```bash
python src/run.py --inject-orphan
```

A successful negative test exits with code **42** and prints `EXPECTED_ORPHAN_REJECTION`. It deliberately does **not** publish `output/report.json`. Any other failure is a defect, not a passing negative test.

The fixture uses two simulated tenant labels, order dates in January–March 2025, line quantities and decimal prices, 8% synthetic tax and fixed $2.50 freight. `net_sales` means **line sales excluding tax and freight**. Month is based on the fixture's date-only order date. There are no returns, cancellations, exchange rates, or access-control guarantees.

CI runs the positive path, repeats it for deterministic output comparison, then injects an orphan. Full AdventureWorks extraction and benchmarks are **not implemented**.

## Limitations

This validates a tiny synthetic pipeline, not SQL Server extraction, production performance, authorization, or real-world ROI. The fixture controls are independent of dbt's mart queries, but the generator and expected-value logic share one code module. Larger datasets and richer accounting semantics require separate contracts.
