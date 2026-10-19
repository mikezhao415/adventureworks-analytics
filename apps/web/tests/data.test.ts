import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import demo from "../data/demo.json";
import {
  dashboard,
  validateDocument,
  validateFilter,
  stableJson,
  summarize,
} from "../lib/data";
import type { DashboardDocument } from "../lib/schema";
import { money } from "../lib/format";
function example(): DashboardDocument {
  const data: DashboardDocument["data"] = {
    period: { start: "2014-01-01", end: "2014-01-02" },
    dimensions: {
      territories: [
        { key: 1, name: "North" },
        { key: 2, name: "South" },
      ],
      categories: [
        { key: 1, name: "Bikes" },
        { key: 2, name: "Parts" },
      ],
      products: [
        { key: 1, name: "Bike", category_key: 1 },
        { key: 2, name: "Pedal", category_key: 2 },
      ],
    },
    customers: [
      {
        date: "2014-01-01",
        territory_key: 1,
        customer_key: 1,
        order_count: 1,
        units_sold: 3,
        net_line_sales: "10.000001",
        header_subtotal: "10.0000",
        tax: "1.0000",
        freight: "0.0000",
        total_due: "11.0000",
      },
      {
        date: "2014-01-02",
        territory_key: 2,
        customer_key: 2,
        order_count: 2,
        units_sold: 5,
        net_line_sales: "20.000002",
        header_subtotal: "20.0001",
        tax: "2.0000",
        freight: "0.0000",
        total_due: "22.0001",
      },
    ],
    products: [
      {
        date: "2014-01-01",
        territory_key: 1,
        product_key: 1,
        order_count: 1,
        units_sold: 1,
        net_line_sales: "4.000000",
      },
      {
        date: "2014-01-01",
        territory_key: 1,
        product_key: 2,
        order_count: 1,
        units_sold: 2,
        net_line_sales: "6.000001",
      },
      {
        date: "2014-01-02",
        territory_key: 2,
        product_key: 1,
        order_count: 2,
        units_sold: 5,
        net_line_sales: "20.000002",
      },
    ],
    categories: [
      {
        date: "2014-01-01",
        territory_key: 1,
        category_key: 1,
        order_count: 1,
        units_sold: 1,
        net_line_sales: "4.000000",
      },
      {
        date: "2014-01-01",
        territory_key: 1,
        category_key: 2,
        order_count: 1,
        units_sold: 2,
        net_line_sales: "6.000001",
      },
      {
        date: "2014-01-02",
        territory_key: 2,
        category_key: 1,
        order_count: 2,
        units_sold: 5,
        net_line_sales: "20.000002",
      },
    ],
  };
  return {
    ...demo,
    data,
    content_sha256: createHash("sha256").update(stableJson(data)).digest("hex"),
  } as DashboardDocument;
}
describe("validated dashboard boundary", () => {
  it("accepts the exported demo and rejects changed content", () => {
    expect(validateDocument(demo).provenance.mode).toBe("offline_fixture");
    const bad = structuredClone(demo);
    bad.data.customers[0].net_line_sales = "999.000000";
    expect(() => validateDocument(bad)).toThrow("checksum");
  });
  it("rejects a duplicate cell even if the checksum is recalculated", () => {
    const bad = example();
    bad.data.customers.push(bad.data.customers[0]);
    bad.content_sha256 = createHash("sha256")
      .update(stableJson(bad.data))
      .digest("hex");
    expect(() => validateDocument(bad)).toThrow("Duplicate dashboard cell");
  });
  it("rejects schema drift and missing relationships", () => {
    const bad = example();
    bad.data.products[0].net_line_sales = "4.0000001";
    expect(() => validateDocument(bad)).toThrow();
    const orphan = example();
    orphan.data.dimensions.products = [];
    orphan.content_sha256 = createHash("sha256")
      .update(stableJson(orphan.data))
      .digest("hex");
    expect(() => validateDocument(orphan)).toThrow("Missing product dimension");
  });
  it("sums disjoint cells without adding product order counts to the overview", () => {
    const d = dashboard(validateDocument(example()));
    expect(d.summary).toMatchObject({
      order_count: 3,
      units_sold: 8,
      net_line_sales: "30.000003",
      average_order_value: "10.0000",
    });
    expect(d.products.reduce((s, p) => s + p.order_count, 0)).toBe(4);
    expect(d.customers[0].name).toBe("Customer 00002");
    expect(d.territories[0].net_line_sales).toBe("20.000002");
    expect(d.monthly[0].net_line_sales).toBe("30.000003");
  });
  it("includes exact day boundaries and combines date, territory and category safely", () => {
    const d = dashboard(example(), {
      start: "2014-01-01",
      end: "2014-01-01",
      territory: "1",
      category: "2",
    });
    expect(d.summary.order_count).toBe(1);
    expect(d.summary.net_line_sales).toBe("10.000001");
    expect(d.products.map((p) => p.name)).toEqual(["Pedal"]);
    expect(d.categories[0].net_line_sales).toBe("6.000001");
    expect(d.customers[0].net_line_sales).toBe("10.000001");
  });
  it("does not propagate a category selection to header-based metrics", () => {
    const all = dashboard(example()),
      filtered = dashboard(example(), { category: "2" });
    expect(filtered.summary).toEqual(all.summary);
    expect(filtered.monthly).toEqual(all.monthly);
    expect(filtered.territories).toEqual(all.territories);
    expect(filtered.customers).toEqual(all.customers);
    expect(filtered.products).toHaveLength(1);
  });
  it("returns honest empty measures for no matching dates or territory intersection", () => {
    const d = dashboard(example(), { start: "2015-01-01", end: "2015-01-01" });
    expect(d.summary.order_count).toBe(0);
    expect(d.summary.average_order_value).toBeNull();
    expect(d.monthly).toEqual([]);
    expect(
      dashboard(example(), {
        start: "2014-01-01",
        end: "2014-01-01",
        territory: "2",
      }).summary.order_count,
    ).toBe(0);
  });
  it("rejects malformed, reversed, unknown and impossible filters", () => {
    for (const query of [
      { start: "2014-02-30" },
      { start: "2014-02-01", end: "2014-01-01" },
      { territory: "999" },
      { category: "999" },
      { sql: "select 1" },
    ] as Record<string, string>[])
      expect(() => validateFilter(query, example())).toThrow();
  });
  it("rounds AOV and displayed amounts halfway away from zero without floating point", () => {
    expect(
      summarize([
        {
          order_count: 2,
          units_sold: 1,
          net_line_sales: "2.000000",
          header_subtotal: "2.0001",
        },
      ]).average_order_value,
    ).toBe("1.0001");
    expect(money("999.995000", 2)).toBe("1,000.00");
    expect(money("9007199254740993.123456")).toBe(
      "9,007,199,254,740,993.123456",
    );
    expect(money(null)).toBe("—");
  });
});
