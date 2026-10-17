import unittest
from decimal import Decimal
from src.run import fixture


class FixtureTests(unittest.TestCase):
    def test_repeatable(self):
        self.assertEqual(fixture(), fixture())

    def test_controls(self):
        orders, lines, expected = fixture()
        self.assertEqual(len(orders), 100)
        self.assertEqual({o[0] for o in orders}, {"tenant_a", "tenant_b"})
        self.assertEqual(sum(v["orders"] for v in expected.values()), 100)
        self.assertTrue(all(isinstance(v["net_sales"], Decimal) for v in expected.values()))
        self.assertEqual(len({(l[0], l[1]) for l in lines}), len(lines))

    def test_order_financials(self):
        orders, lines, _ = fixture()
        by_order = {}
        for tenant, _, oid, _, _, amount in lines:
            key = (tenant, oid)
            by_order[key] = by_order.get(key, Decimal(0)) + Decimal(amount)
        for tenant, oid, _, subtotal, tax, freight, due in orders:
            self.assertEqual(Decimal(subtotal), by_order[(tenant, oid)])
            self.assertEqual(Decimal(due), Decimal(subtotal) + Decimal(tax) + Decimal(freight))


if __name__ == "__main__":
    unittest.main()
