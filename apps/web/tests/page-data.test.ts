import { describe, expect, it } from "vitest";
import demo from "../data/demo.json";
import { dashboard, validateDocument } from "../lib/data";
import { projectPageData } from "../lib/page-data";

const doc = validateDocument(demo);
const scenarios: Record<string, string>[] = [
  {},
  { territory: "1,2", category: "1,2" },
  { start: "2030-01-01", end: "2030-01-01" },
];
describe("page serialization preserves complete analytical results", () => {
  it.each(scenarios)(
    "keeps exact values and every customer for %j",
    (filters) => {
      const full = dashboard(doc, filters);
      const before = JSON.stringify(full);
      const overview = projectPageData(full, "overview");
      expect(overview.summary).toEqual(full.summary);
      expect(overview.counts).toEqual({
        months: full.monthly.length,
        customers: full.customers.length,
        territories: full.territories.length,
      });
      expect(projectPageData(full, "trends").monthly).toEqual(full.monthly);
      const products = projectPageData(full, "products");
      expect(products.products).toEqual(full.products);
      expect(products.categories).toEqual(full.categories);
      expect(products.category_net_line_sales).toBe(
        full.category_net_line_sales,
      );
      expect(projectPageData(full, "territories").territories).toEqual(
        full.territories,
      );
      const customers = projectPageData(full, "customers");
      expect(
        customers.customerValues.map(
          ([
            key,
            name,
            order_count,
            net_line_sales,
            contribution,
            average_order_value,
          ]) => ({
            key,
            name,
            order_count,
            net_line_sales,
            contribution,
            average_order_value,
          }),
        ),
      ).toEqual(
        full.customers.map(
          ({
            key,
            name,
            order_count,
            net_line_sales,
            contribution,
            average_order_value,
          }) => ({
            key,
            name,
            order_count,
            net_line_sales,
            contribution,
            average_order_value,
          }),
        ),
      );
      for (const view of [
        "overview",
        "trends",
        "products",
        "customers",
        "territories",
        "filters",
      ] as const)
        expect(projectPageData(full, view).filters).toEqual(full.filters);
      expect(JSON.stringify(full)).toBe(before);
    },
  );
  it("keeps unrelated rows out of the server/client boundary", () => {
    const full = dashboard(doc);
    for (const view of [
      "overview",
      "trends",
      "products",
      "territories",
      "filters",
    ] as const) {
      const projected = projectPageData(full, view);
      expect(projected).not.toHaveProperty("customers");
      expect(projected).not.toHaveProperty("customerValues");
      expect(JSON.stringify(projected)).not.toContain(full.customers[0].name);
    }
    expect(Object.keys(projectPageData(full, "filters")).sort()).toEqual([
      "filters",
      "view",
    ]);
    expect(Object.keys(projectPageData(full, "customers")).sort()).toEqual([
      "customerValues",
      "filters",
      "view",
    ]);
  });
});
