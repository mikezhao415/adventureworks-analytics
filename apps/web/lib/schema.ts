import { z } from "zod";
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const key = z.number().int().min(-1).max(2147483647);
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const date = new Date(s + "T00:00:00Z");
    return !isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === s;
  }, "Invalid calendar date");
const decimal = (scale: number) =>
  z.string().regex(new RegExp(`^\\d{1,32}\\.\\d{${scale}}$`));
const base = {
  date: isoDate,
  territory_key: key,
  order_count: integer,
  units_sold: integer,
  net_line_sales: decimal(6),
};
const control = z.object({ result: z.literal("pass"), rows: integer });
export const documentSchema = z.object({
  version: z.literal(1),
  content_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  provenance: z.object({
    mode: z.enum(["offline_fixture", "real_adventureworks"]),
    snapshot_id: z.string(),
    input_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    source_extracted_at: z.string(),
    analytics_revision: z.string(),
    export_revision: z.string(),
    working_tree_dirty: z.boolean(),
    reconciliation: z.object({
      mart_sales_summary: control,
      mart_sales_monthly: control,
      mart_sales_customer: control,
      mart_sales_territory: control,
      mart_sales_product: control,
      mart_sales_category: control,
    }),
  }),
  data: z.object({
    period: z.object({ start: isoDate.nullable(), end: isoDate.nullable() }),
    customers: z.array(
      z.object({
        ...base,
        customer_key: key,
        header_subtotal: decimal(4),
        tax: decimal(4),
        freight: decimal(4),
        total_due: decimal(4),
      }),
    ),
    products: z.array(z.object({ ...base, product_key: key })),
    categories: z.array(z.object({ ...base, category_key: key })),
    dimensions: z.object({
      territories: z.array(z.object({ key, name: z.string() })),
      categories: z.array(z.object({ key, name: z.string() })),
      products: z.array(z.object({ key, name: z.string(), category_key: key })),
    }),
  }),
});
export type DashboardDocument = z.infer<typeof documentSchema>;
export type Filter = {
  start: string;
  end: string;
  territory: string;
  category: string;
};
