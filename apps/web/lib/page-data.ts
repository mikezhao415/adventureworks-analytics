import type { DashboardData } from "./data";
import type { View } from "./navigation";

/** Exact display fields, in a named tuple to avoid repeating property names 19k times. */
export type CustomerValues = [
  key: string,
  name: string,
  order_count: number,
  net_line_sales: string,
  contribution: string,
  average_order_value: string | null,
];
type WithView<V extends View, T> = {
  view: V;
  filters: DashboardData["filters"];
} & T;
export type PageDataByView = {
  overview: WithView<
    "overview",
    {
      summary: DashboardData["summary"];
      counts: { months: number; customers: number; territories: number };
    }
  >;
  trends: WithView<"trends", Pick<DashboardData, "monthly">>;
  products: WithView<
    "products",
    Pick<
      DashboardData,
      "products" | "categories" | "category_net_line_sales" | "options"
    >
  >;
  customers: WithView<"customers", { customerValues: CustomerValues[] }>;
  territories: WithView<"territories", Pick<DashboardData, "territories">>;
  filters: WithView<"filters", object>;
};
export type PageData = PageDataByView[View];

/** Project after complete analytical composition; never limit rows or recalculate metrics. */
export function projectPageData<V extends View>(
  data: DashboardData,
  view: V,
): PageDataByView[V];
export function projectPageData(data: DashboardData, view: View): PageData {
  const filters = data.filters;
  switch (view) {
    case "overview":
      return {
        view,
        filters,
        summary: data.summary,
        counts: {
          months: data.monthly.length,
          customers: data.customers.length,
          territories: data.territories.length,
        },
      };
    case "trends":
      return { view, filters, monthly: data.monthly };
    case "products":
      return {
        view,
        filters,
        products: data.products,
        categories: data.categories,
        category_net_line_sales: data.category_net_line_sales,
        options: data.options,
      };
    case "customers":
      return {
        view,
        filters,
        customerValues: data.customers.map((r) => [
          r.key,
          r.name,
          r.order_count,
          r.net_line_sales,
          r.contribution,
          r.average_order_value,
        ]),
      };
    case "territories":
      return { view, filters, territories: data.territories };
    case "filters":
      return { view, filters };
  }
}
