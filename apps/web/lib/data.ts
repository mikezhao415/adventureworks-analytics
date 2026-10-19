import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  documentSchema,
  isoDate,
  type DashboardDocument,
  type Filter,
} from "./schema";

export class FilterError extends Error {}
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value !== null && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => JSON.stringify(k) + ":" + stableJson(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export function validateDocument(input: unknown): DashboardDocument {
  const doc = documentSchema.parse(input);
  if (
    createHash("sha256").update(stableJson(doc.data)).digest("hex") !==
    doc.content_sha256
  )
    throw new Error("Dashboard content checksum differs");
  const dimensions = doc.data.dimensions;
  for (const items of Object.values(dimensions))
    if (new Set(items.map((r) => r.key)).size !== items.length)
      throw new Error("Duplicate dimension key");
  for (const [section, key] of [
    ["customers", "customer_key"],
    ["products", "product_key"],
    ["categories", "category_key"],
  ] as const) {
    const unique = new Set<string>();
    for (const row of doc.data[section]) {
      const identity = [
        row.date,
        row.territory_key,
        Reflect.get(row, key),
      ].join("|");
      if (unique.has(identity)) throw new Error("Duplicate dashboard cell");
      unique.add(identity);
      if (!dimensions.territories.some((t) => t.key === row.territory_key))
        throw new Error("Missing territory dimension");
    }
  }
  for (const row of doc.data.products)
    if (!dimensions.products.some((p) => p.key === row.product_key))
      throw new Error("Missing product dimension");
  for (const row of doc.data.categories)
    if (!dimensions.categories.some((c) => c.key === row.category_key))
      throw new Error("Missing category dimension");
  for (const p of dimensions.products)
    if (!dimensions.categories.some((c) => c.key === p.category_key))
      throw new Error("Missing product category");
  return doc;
}
export async function loadDocument(): Promise<DashboardDocument> {
  const file =
    process.env.AW_DASHBOARD_DATA ||
    path.join(process.cwd(), "data", "demo.json");
  return validateDocument(
    JSON.parse(await readFile(/* turbopackIgnore: true */ file, "utf8")),
  );
}
export function validateFilter(
  input: Record<string, string>,
  doc: DashboardDocument,
): Filter {
  if (
    Object.keys(input).some(
      (k) => !["start", "end", "territory", "category"].includes(k),
    )
  )
    throw new FilterError("Unknown filter");
  const start = input.start || doc.data.period.start || "2014-01-01",
    end = input.end || doc.data.period.end || "2014-12-31";
  if (
    !isoDate.safeParse(start).success ||
    !isoDate.safeParse(end).success ||
    start > end
  )
    throw new FilterError(
      "Choose a valid date range with the start on or before the end.",
    );
  const territory = input.territory || "all",
    category = input.category || "all";
  if (
    territory !== "all" &&
    !doc.data.dimensions.territories.some((t) => String(t.key) === territory)
  )
    throw new FilterError("Unknown territory");
  if (
    category !== "all" &&
    !doc.data.dimensions.categories.some((c) => String(c.key) === category)
  )
    throw new FilterError("Unknown category");
  return { start, end, territory, category };
}
const micros = (s: string) => BigInt(s.replace(".", ""));
const fixed = (n: bigint, scale: number) =>
  `${n / 10n ** BigInt(scale)}.${(n % 10n ** BigInt(scale)).toString().padStart(scale, "0")}`;
/** Exact composition of disjoint date/territory cells; never sum ratios. */
export function summarize(
  rows: {
    order_count: number;
    units_sold: number;
    net_line_sales: string;
    header_subtotal?: string;
  }[],
) {
  let orders = 0,
    units = 0,
    sales = 0n,
    subtotal = 0n;
  for (const r of rows) {
    orders += r.order_count;
    units += r.units_sold;
    sales += micros(r.net_line_sales);
    if (r.header_subtotal) subtotal += micros(r.header_subtotal);
  }
  if (!Number.isSafeInteger(orders) || !Number.isSafeInteger(units))
    throw new Error("Aggregate integer exceeds safe range");
  return {
    order_count: orders,
    units_sold: units,
    net_line_sales: fixed(sales, 6),
    header_subtotal: fixed(subtotal, 4),
    average_order_value: orders
      ? fixed((subtotal * 2n + BigInt(orders)) / (2n * BigInt(orders)), 4)
      : null,
  };
}
function group<T>(rows: T[], key: (r: T) => string) {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const g = out.get(k) || [];
    g.push(row);
    out.set(k, g);
  }
  return [...out.entries()];
}
export function dashboard(
  doc: DashboardDocument,
  input: Record<string, string> = {},
) {
  const filters = validateFilter(input, doc),
    d = doc.data;
  const included = (r: { date: string; territory_key: number }) =>
    r.date >= filters.start &&
    r.date <= filters.end &&
    (filters.territory === "all" ||
      String(r.territory_key) === filters.territory);
  const customers = d.customers.filter(included),
    summary = summarize(customers);
  const ranked = <T extends { net_line_sales: string }>(a: T[]) =>
    a.sort((a, b) =>
      micros(a.net_line_sales) > micros(b.net_line_sales)
        ? -1
        : micros(a.net_line_sales) < micros(b.net_line_sales)
          ? 1
          : 0,
    );
  const name = (items: { key: number; name: string }[], id: string) =>
    items.find((r) => String(r.key) === id)?.name || id;
  const contribution = (value: string) =>
    summary.net_line_sales === "0.000000"
      ? "0.00"
      : fixed(
          (micros(value) * 10000n + micros(summary.net_line_sales) / 2n) /
            micros(summary.net_line_sales),
          2,
        );
  const monthly = group(customers, (r) => r.date.slice(0, 7))
    .map(([month, rows]) => ({ month, ...summarize(rows) }))
    .sort((a, b) => a.month.localeCompare(b.month));
  const customerRows = ranked(
    group(customers, (r) => String(r.customer_key)).map(([key, rows]) => ({
      key,
      name: `Customer ${key.padStart(5, "0")}`,
      ...summarize(rows),
      contribution: contribution(summarize(rows).net_line_sales),
    })),
  );
  const territories = ranked(
    group(customers, (r) => String(r.territory_key)).map(([key, rows]) => ({
      key,
      name: name(d.dimensions.territories, key),
      ...summarize(rows),
    })),
  );
  const products = ranked(
    group(
      d.products.filter(
        (r) =>
          included(r) &&
          (filters.category === "all" ||
            String(
              d.dimensions.products.find((p) => p.key === r.product_key)
                ?.category_key,
            ) === filters.category),
      ),
      (r) => String(r.product_key),
    ).map(([key, rows]) => ({
      key,
      name: name(d.dimensions.products, key),
      ...summarize(rows),
    })),
  );
  const categories = ranked(
    group(
      d.categories.filter(
        (r) =>
          included(r) &&
          (filters.category === "all" ||
            String(r.category_key) === filters.category),
      ),
      (r) => String(r.category_key),
    ).map(([key, rows]) => ({
      key,
      name: name(d.dimensions.categories, key),
      ...summarize(rows),
    })),
  );
  return {
    filters,
    summary,
    monthly,
    customers: customerRows,
    territories,
    products,
    categories,
    provenance: doc.provenance,
    period: d.period,
    options: {
      territories: d.dimensions.territories,
      categories: d.dimensions.categories,
    },
  };
}
export type DashboardData = ReturnType<typeof dashboard>;
