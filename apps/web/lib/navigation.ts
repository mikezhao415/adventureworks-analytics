import type { Filter } from "./schema";
export const PAGES = [
  {
    path: "/",
    title: "Sales overview",
    description: "Shipped sales, orders and units in the selected period.",
  },
  {
    path: "/trends",
    title: "Sales trends",
    description: "Monthly sales and order activity within the selected days.",
  },
  {
    path: "/products",
    title: "Product & category performance",
    description:
      "Products and categories ranked by selected-period net line sales.",
  },
  {
    path: "/customers",
    title: "Customer insights",
    description: "Customer sales, order frequency and relative performance.",
  },
  {
    path: "/territories",
    title: "Territory performance",
    description:
      "Compare sales, orders and header-based average order value by order territory.",
  },
  {
    path: "/definitions",
    title: "Metric definitions",
    description: "Calculation rules, filter scopes and data provenance.",
  },
] as const;
export type View =
  "overview" | "trends" | "products" | "customers" | "territories";
export type PageSearchParams = Record<string, string | string[] | undefined>;
export function scalarFilters(input: PageSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
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
  return path + (query ? "?" + query : "");
}
