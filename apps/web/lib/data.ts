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
/** Release identity is code-reviewed; runtime paths cannot select production data. */
export const PUBLIC_ARTIFACT = {
  file: "adventureworks2022.json",
  bytes: 16136806,
  sha256: "b4b22c99becf5b7e26a53c8b3d04280b99db3fd28b2dccf9d16c01c682e80040",
  content_sha256:
    "2204bd6a695c0657692e28e9848b5eb1628b50e3dfb463683d322487824938dd",
  snapshot_id: "20261019T001836Z-ee2547d8e90749b68133c76a806f9e6f",
} as const;
export function validatePublicArtifact(raw: Buffer): DashboardDocument {
  if (
    raw.length !== PUBLIC_ARTIFACT.bytes ||
    createHash("sha256").update(raw).digest("hex") !== PUBLIC_ARTIFACT.sha256
  )
    throw new Error("Unapproved dashboard file checksum");
  const doc = validateDocument(JSON.parse(raw.toString("utf8")));
  if (doc.provenance.mode !== "real_adventureworks")
    throw new Error("Production dashboard requires AdventureWorks sample data");
  if (doc.provenance.snapshot_id !== PUBLIC_ARTIFACT.snapshot_id)
    throw new Error("Unapproved dashboard snapshot");
  if (doc.content_sha256 !== PUBLIC_ARTIFACT.content_sha256)
    throw new Error("Unapproved dashboard content checksum");
  return doc;
}
// Only successful immutable release content is reused. Recheck bytes on every read
// so a missing/replaced file still fails closed in a warm process.
let validatedRelease:
  { sha256: string; document: DashboardDocument } | undefined;
function freezeRelease(document: DashboardDocument): DashboardDocument {
  const pending: object[] = [document];
  while (pending.length) {
    const value = pending.pop()!;
    Object.freeze(value);
    for (const child of Object.values(value))
      if (child !== null && typeof child === "object") pending.push(child);
  }
  return document;
}
export async function loadDocument(): Promise<DashboardDocument> {
  if (process.env.NODE_ENV === "production") {
    const file = path.join(process.cwd(), "data", PUBLIC_ARTIFACT.file);
    const raw = await readFile(/* turbopackIgnore: true */ file);
    if (
      raw.length !== PUBLIC_ARTIFACT.bytes ||
      createHash("sha256").update(raw).digest("hex") !== PUBLIC_ARTIFACT.sha256
    )
      throw new Error("Unapproved dashboard file checksum");
    if (validatedRelease?.sha256 === PUBLIC_ARTIFACT.sha256)
      return validatedRelease.document;
    const document = freezeRelease(validatePublicArtifact(raw));
    validatedRelease = { sha256: PUBLIC_ARTIFACT.sha256, document };
    return document;
  }
  const file =
    process.env.AW_DASHBOARD_DATA ||
    path.join(process.cwd(), "data", "demo.json");
  return validateDocument(
    JSON.parse(await readFile(/* turbopackIgnore: true */ file, "utf8")),
  );
}
function validSelection(value: string, options: { key: number }[]) {
  const keys = value.split(",");
  return (
    new Set(keys).size === keys.length &&
    keys.every((key) => options.some((o) => String(o.key) === key))
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
  const start = input.start ?? doc.data.period.start ?? "2014-01-01",
    end = input.end ?? doc.data.period.end ?? "2014-12-31";
  if (
    !isoDate.safeParse(start).success ||
    !isoDate.safeParse(end).success ||
    start > end
  )
    throw new FilterError(
      "Choose a valid date range with the start on or before the end.",
    );
  const territory = input.territory ?? "all",
    category = input.category ?? "all";
  if (
    territory !== "all" &&
    !validSelection(territory, doc.data.dimensions.territories)
  )
    throw new FilterError("Unknown territory");
  if (
    category !== "all" &&
    !validSelection(category, doc.data.dimensions.categories)
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
      filters.territory.split(",").includes(String(r.territory_key)));
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
            filters.category
              .split(",")
              .includes(
                String(
                  d.dimensions.products.find((p) => p.key === r.product_key)
                    ?.category_key,
                ),
              )),
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
            filters.category.split(",").includes(String(r.category_key))),
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
    category_net_line_sales: fixed(
      categories.reduce((sum, row) => sum + micros(row.net_line_sales), 0n),
      6,
    ),
    provenance: doc.provenance,
    period: d.period,
    options: {
      territories: d.dimensions.territories,
      categories: d.dimensions.categories,
    },
  };
}
export type DashboardData = ReturnType<typeof dashboard>;
