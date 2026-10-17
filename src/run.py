"""Reproducible synthetic sales pipeline. Python 3.13; run from repository root."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import random
import subprocess
import sys
from decimal import Decimal

import duckdb

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output"
DB = OUT / "slice.duckdb"
REPORT = OUT / "report.json"
CENT = Decimal("0.01")


def fixture(seed=416, per_tenant=50):
    rng = random.Random(seed)
    orders, lines = [], []
    expected = {}
    for tenant in ("tenant_a", "tenant_b"):
        for n in range(1, per_tenant + 1):
            oid = f"O{n:04d}"
            date = dt.date(2025, 1 + (n % 3), 1 + (n % 25))
            subtotal = Decimal("0.0000")
            units = 0
            for k in range(1, rng.randint(2, 4)):
                quantity = rng.randint(1, 5)
                price = Decimal(rng.randint(100, 8000)) / 100
                amount = (price * quantity).quantize(CENT)
                lines.append((tenant, f"L{n:04d}-{k}", oid, f"P{k}", quantity, str(amount)))
                subtotal += amount
                units += quantity
            tax = (subtotal * Decimal("0.08")).quantize(CENT)
            freight = Decimal("2.50")
            total = subtotal + tax + freight
            orders.append((tenant, oid, date.isoformat(), str(subtotal), str(tax), str(freight), str(total)))
            key = (tenant, date.replace(day=1).isoformat())
            bucket = expected.setdefault(key, {"orders": 0, "units": 0, "net_sales": Decimal("0.0000")})
            bucket["orders"] += 1
            bucket["units"] += units
            bucket["net_sales"] += subtotal
    return orders, lines, expected


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=416)
    parser.add_argument("--inject-orphan", action="store_true")
    args = parser.parse_args()
    OUT.mkdir(exist_ok=True)
    REPORT.unlink(missing_ok=True)
    DB.unlink(missing_ok=True)
    orders, lines, expected = fixture(args.seed)
    if args.inject_orphan:
        lines.append(("tenant_a", "BAD-LINE", "MISSING", "P0", 1, "1.00"))
    con = duckdb.connect(str(DB))
    con.execute("create table raw_orders (tenant_id varchar, order_id varchar, order_date date, subtotal decimal(18,4), tax decimal(18,4), freight decimal(18,4), total_due decimal(18,4))")
    con.execute("create table raw_lines (tenant_id varchar, line_id varchar, order_id varchar, product_id varchar, quantity integer, amount decimal(18,4))")
    con.executemany("insert into raw_orders values (?,?,?,?,?,?,?)", orders)
    con.executemany("insert into raw_lines values (?,?,?,?,?,?)", lines)
    con.close()
    env = dict(os.environ, SLICE_DB_PATH=str(DB))
    command = [sys.executable, "-m", "dbt", "build", "--project-dir", str(ROOT / "dbt"), "--profiles-dir", str(ROOT / "dbt"), "--target-path", str(OUT / "dbt-target"), "--log-path", str(OUT / "dbt-logs")]
    result = subprocess.run(command, env=env, check=False)
    if args.inject_orphan:
        path = OUT / "dbt-target" / "run_results.json"
        if not path.exists():
            raise RuntimeError("dbt results missing: cannot verify expected rejection")
        failures = [r for r in json.loads(path.read_text())["results"] if r["status"] in ("fail", "error")]
        if len(failures) != 1 or failures[0]["status"] != "fail" or not failures[0]["unique_id"].endswith(".no_orphans") or result.returncode == 0:
            raise RuntimeError(f"Unexpected dbt failure pattern: {[(r['unique_id'],r['status']) for r in failures]}")
        print("EXPECTED_ORPHAN_REJECTION: no_orphans failed; no report published")
        return 42
    if result.returncode:
        raise RuntimeError("dbt build failed; no report published")
    con = duckdb.connect(str(DB), read_only=True)
    rows = con.execute("select tenant_id, cast(sales_month as varchar), orders, units, net_sales from monthly_sales order by 1,2").fetchall()
    con.close()
    actual = {(tenant, month): (int(count), int(units), Decimal(str(sales))) for tenant, month, count, units, sales in rows}
    assert set(actual) == set(expected), "Tenant/month keys differ"
    for key, control in expected.items():
        assert actual[key] == (control["orders"], control["units"], control["net_sales"]), f"Reconciliation failed for {key}"
    report = {"mode": "synthetic", "seed": args.seed, "source_orders": len(orders), "source_lines": len(lines),
              "totals": {"orders": len(orders), "units": sum(v["units"] for v in expected.values()), "net_sales": str(sum((v["net_sales"] for v in expected.values()), Decimal("0.0000")))},
              "monthly": [{"tenant_id": tenant, "sales_month": month, "orders": v["orders"], "units": v["units"], "net_sales": str(v["net_sales"])} for (tenant, month), v in sorted(expected.items())]}
    REPORT.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(f"PASS: {len(orders)} orders; independently reconciled {len(rows)} monthly groups; report={REPORT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
