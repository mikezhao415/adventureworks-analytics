import type { Filter } from "./schema";
export const PAGES = [
  {
    path: "/",
    title: "Sales Overview",
    description: "Shipped sales, orders and units in the selected period.",
  },
  {
    path: "/trends",
    title: "Sales Trends",
    description: "Monthly sales and order activity within the selected days.",
  },
  {
    path: "/products",
    title: "Products & Categories",
    description:
      "Products and categories ranked by selected-period net line sales.",
  },
  {
    path: "/customers",
    title: "Customers",
    description: "Customer sales, order frequency and relative performance.",
  },
  {
    path: "/territories",
    title: "Territory Performance",
    description:
      "Compare sales, orders and header-based average order value by order territory.",
  },
  {
    path: "/definitions",
    title: "Data & Definitions",
    description: "Calculation rules, filter scopes and data provenance.",
  },
  {
    path: "/filters",
    title: "Filters",
    description: "Configure the shared analytics selection.",
  },
  {
    path: "/lineage",
    title: "Data lineage",
    description: "Explore reviewed dbt-derived sales dependencies.",
  },
] as const;
export type View =
  "overview" | "trends" | "products" | "customers" | "territories" | "filters";
export type PageSearchParams = Record<string, string | string[] | undefined>;
export function scalarFilters(input: PageSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!["start", "end", "territory", "category"].includes(key)) continue;
    if (Array.isArray(value))
      throw new Error("Duplicate filter values are not allowed.");
    if (value !== undefined) out[key] = value;
  }
  return out;
}
export function filterHref(path: string, filters: Filter) {
  return path + "?" + new URLSearchParams(filters).toString();
}
export function preserveQuery(path: string, query: string) {
  if (path === "/lineage") return path;
  const filters = new URLSearchParams(query);
  filters.delete("node");
  filters.delete("mode");
  const value = filters.toString();
  return path + (value ? "?" + value : "");
}
