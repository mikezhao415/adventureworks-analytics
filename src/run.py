"""Deterministic synthetic BI slice with fail-closed validation and publication."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import random
import subprocess
import sys
import tempfile
from decimal import Decimal

import duckdb

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output"
DB = OUT / "slice.duckdb"
REPORT = OUT / "report.json"
CENT = Decimal("0.01")
NEGATIVE_TESTS = {
    "orphan": "no_orphans",
    "duplicate-order": "unique_order_keys",
    "wrong-subtotal": "reconcile_headers",
}


class ValidationError(RuntimeError):
    pass


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


def run_dbt(action, env, selection=None):
    executable = Path(sys.executable).parent / ("dbt.exe" if os.name == "nt" else "dbt")
    command = [str(executable), action, "--project-dir", str(ROOT / "dbt"),
               "--profiles-dir", str(ROOT / "dbt"), "--target-path", str(OUT / "dbt-target"),
               "--log-path", str(OUT / "dbt-logs")]
    if selection:
        command += ["--select", selection]
    return subprocess.run(command, env=env, check=False).returncode


def verify_named_failure(test_name):
    results_path = OUT / "dbt-target" / "run_results.json"
    if not results_path.is_file():
        raise ValidationError("dbt test results missing")
    results = json.loads(results_path.read_text())["results"]
    if len(results) != 1:
        raise ValidationError(f"Expected exactly one selected test, got {len(results)}")
    result = results[0]
    if result["status"] != "fail" or result["unique_id"].split(".")[-1] != test_name:
        raise ValidationError(f"Wrong failing test: {result['unique_id']} ({result['status']})")


def atomic_publish(report):
    OUT.mkdir(exist_ok=True)
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=OUT,
                                         prefix=".report-", suffix=".tmp", delete=False) as f:
            temp_path = Path(f.name)
            json.dump(report, f, indent=2, sort_keys=True)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp_path, REPORT)
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=416)
    parser.add_argument("--inject", choices=tuple(NEGATIVE_TESTS))
    parser.add_argument("--inject-orphan", action="store_true",
                        help="Legacy alias for --inject orphan")
    args = parser.parse_args()
    if args.inject_orphan:
        if args.inject:
            parser.error("Specify only one injection mode")
        args.inject = "orphan"
    OUT.mkdir(exist_ok=True)
    REPORT.unlink(missing_ok=True)
    DB.unlink(missing_ok=True)
    orders, lines, expected = fixture(args.seed)
    if args.inject == "orphan":
        lines.append(("tenant_a", "BAD-LINE", "MISSING", "P0", 1, "1.00"))
    elif args.inject == "duplicate-order":
        orders.append(orders[0])
    elif args.inject == "wrong-subtotal":
        first = list(orders[0])
        first[3] = str(Decimal(first[3]) + CENT)
        orders[0] = tuple(first)
    con = duckdb.connect(str(DB))
    try:
        con.execute("create table raw_orders (tenant_id varchar, order_id varchar, order_date date, subtotal decimal(18,4), tax decimal(18,4), freight decimal(18,4), total_due decimal(18,4))")
        con.execute("create table raw_lines (tenant_id varchar, line_id varchar, order_id varchar, product_id varchar, quantity integer, amount decimal(18,4))")
        con.executemany("insert into raw_orders values (?,?,?,?,?,?,?)", orders)
        con.executemany("insert into raw_lines values (?,?,?,?,?,?)", lines)
    finally:
        con.close()
    env = dict(os.environ, SLICE_DB_PATH=str(DB))
    if args.inject:
        if run_dbt("run", env):
            raise ValidationError("dbt model build failed before targeted negative test")
        target = NEGATIVE_TESTS[args.inject]
        status = run_dbt("test", env, target)
        if status == 0:
            raise ValidationError(f"Injected {args.inject} was not rejected")
        verify_named_failure(target)
        print(f"EXPECTED_REJECTION: {target} failed; no report published")
        return 42
    if run_dbt("build", env):
        raise ValidationError("dbt build failed; no report published")
    con = duckdb.connect(str(DB), read_only=True)
    try:
        rows = con.execute("select tenant_id, cast(sales_month as varchar), orders, units, net_sales from monthly_sales order by 1,2").fetchall()
    finally:
        con.close()
    actual = {(tenant, month): (int(count), int(units), Decimal(str(sales)))
              for tenant, month, count, units, sales in rows}
    if len(actual) != len(rows) or set(actual) != set(expected):
        raise ValidationError("Tenant/month keys or uniqueness differ")
    for key, control in expected.items():
        if actual[key] != (control["orders"], control["units"], control["net_sales"]):
            raise ValidationError(f"Independent reconciliation failed for {key}")
    report = {
        "mode": "synthetic", "seed": args.seed, "source_orders": len(orders),
        "source_lines": len(lines),
        "totals": {
            "orders": sum(v[0] for v in actual.values()),
            "units": sum(v[1] for v in actual.values()),
            "net_sales": str(sum((v[2] for v in actual.values()), Decimal("0.0000"))),
        },
        "monthly": [
            {"tenant_id": tenant, "sales_month": month, "orders": counts[0],
             "units": counts[1], "net_sales": str(counts[2])}
            for (tenant, month), counts in sorted(actual.items())
        ],
    }
    atomic_publish(report)
    print(f"PASS: {len(orders)} orders; independently reconciled {len(rows)} monthly groups; report={REPORT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
