export const METRICS = {
  sales: {
    label: "Net line sales",
    description:
      "Shipped-order line amounts, excluding tax and freight. Six-decimal source precision.",
  },
  orders: {
    label: "Orders",
    description: "Count of shipped orders. Each order is counted once.",
  },
  aov: {
    label: "Average order value",
    description:
      "Header subtotal / shipped orders, rounded to four decimals. Includes all product categories.",
  },
  units: {
    label: "Units sold",
    description: "Sum of shipped line quantities.",
  },
} as const;
/** Formatting preserves decimal strings; chart coordinates alone use approximate numbers. */
export function money(value: string | null, places?: number): string {
  if (value === null) return "—";
  const [whole, fraction = ""] = value.split(".");
  const digits = places ?? fraction.length;
  let amount = BigInt(whole + fraction.padEnd(digits, "0"));
  if (fraction.length > digits) {
    const divisor = 10n ** BigInt(fraction.length - digits);
    amount = (amount + divisor / 2n) / divisor;
  }
  const scale = 10n ** BigInt(digits);
  return (
    (amount / scale).toLocaleString("en-US") +
    (digits ? "." + (amount % scale).toString().padStart(digits, "0") : "")
  );
}
export function count(value: number): string {
  return value.toLocaleString("en-US");
}
export function compactUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
export function shortMonth(value: string): string {
  return new Date(value.slice(0, 7) + "-01T00:00:00Z").toLocaleDateString(
    "en-US",
    { month: "short", year: "2-digit", timeZone: "UTC" },
  );
}

/** Approved native-USD presentation only; exact rounding after aggregation, without FX. */
export function displayAmount(value: string | null): string {
  if (value === null) return "—";
  const rounded = BigInt(money(value, 0).replaceAll(",", ""));
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rounded);
}
