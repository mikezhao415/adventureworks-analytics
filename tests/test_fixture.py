import json
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

from src import run


class FixtureTests(unittest.TestCase):
    def test_repeatable(self):
        self.assertEqual(run.fixture(), run.fixture())
        self.assertNotEqual(run.fixture(seed=416), run.fixture(seed=417))

    def test_controls_and_cross_tenant_keys(self):
        orders, lines, expected = run.fixture()
        self.assertEqual(len(orders), 100)
        self.assertEqual({o[0] for o in orders}, {"tenant_a", "tenant_b"})
        self.assertEqual(sum(v["orders"] for v in expected.values()), 100)
        self.assertTrue(all(isinstance(v["net_sales"], Decimal) for v in expected.values()))
        self.assertEqual(len({(l[0], l[1]) for l in lines}), len(lines))
        self.assertEqual(len({(o[0], o[1]) for o in orders}), len(orders))
        self.assertLess(len({o[1] for o in orders}), len(orders))

    def test_order_financials(self):
        orders, lines, _ = run.fixture()
        by_order = {}
        for tenant, _, oid, _, _, amount in lines:
            key = (tenant, oid)
            by_order[key] = by_order.get(key, Decimal(0)) + Decimal(amount)
        for tenant, oid, _, subtotal, tax, freight, due in orders:
            self.assertEqual(Decimal(subtotal), by_order[(tenant, oid)])
            self.assertEqual(Decimal(due), Decimal(subtotal) + Decimal(tax) + Decimal(freight))

    def test_atomic_publication(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(run, "OUT", Path(directory)), patch.object(
                run, "REPORT", Path(directory) / "report.json"
            ):
                run.atomic_publish({"mode": "synthetic", "total": "12.34"})
                self.assertEqual(json.loads(run.REPORT.read_text())["total"], "12.34")
                self.assertEqual(list(Path(directory).glob("*.tmp")), [])

    def test_named_negative_failure_requires_exact_test(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "dbt-target"
            target.mkdir()
            result = target / "run_results.json"
            with patch.object(run, "OUT", Path(directory)):
                result.write_text(json.dumps({"results": [{
                    "unique_id": "test.adventureworks_slice.no_orphans",
                    "status": "fail",
                }]}))
                run.verify_named_failure("no_orphans")
                with self.assertRaises(run.ValidationError):
                    run.verify_named_failure("unique_order_keys")
                result.write_text(json.dumps({"results": [{
                    "unique_id": "test.adventureworks_slice.no_orphans",
                    "status": "error",
                }]}))
                with self.assertRaises(run.ValidationError):
                    run.verify_named_failure("no_orphans")


if __name__ == "__main__":
    unittest.main()
