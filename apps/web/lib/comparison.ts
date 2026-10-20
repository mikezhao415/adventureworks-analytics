import type { DashboardData } from "./data";
export type Customer = Pick<
  DashboardData["customers"][number],
  | "key"
  | "order_count"
  | "net_line_sales"
  | "average_order_value"
  | "contribution"
>;
export const CUSTOMER_SCALES = {
  order_count: 0,
  net_line_sales: 6,
  average_order_value: 4,
  contribution: 2,
} as const;
export type ComparisonMetric = keyof typeof CUSTOMER_SCALES;
function integer(value: string | number | null, scale: number): bigint | null {
  if (value === null) return null;
  const [whole, fraction = ""] = String(value).split(".");
  return BigInt(whole + fraction.padEnd(scale, "0"));
}
/** Independent ranges over the entire date/territory-filtered dataset, before search/pagination. */
export function comparisonWidths(
  rows: Customer[],
): Map<string, Record<ComparisonMetric, number | null>> {
  const result = new Map(
    rows.map((r) => [r.key, {} as Record<ComparisonMetric, number | null>]),
  );
  for (const [metric, scale] of Object.entries(CUSTOMER_SCALES) as [
    ComparisonMetric,
    number,
  ][]) {
    const values = rows.map((r) => integer(r[metric], scale));
    const present = values.filter((v): v is bigint => v !== null);
    if (!present.length) {
      for (const row of rows) result.get(row.key)![metric] = null;
      continue;
    }
    let min = present[0],
      max = present[0];
    for (const value of present) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
    rows.forEach((row, i) => {
      const value = values[i];
      result.get(row.key)![metric] =
        value === null
          ? null
          : value === 0n
            ? 0
            : max === min
              ? 100
              : Number(((value - min) * 10000n) / (max - min)) / 100;
    });
  }
  return result;
}
