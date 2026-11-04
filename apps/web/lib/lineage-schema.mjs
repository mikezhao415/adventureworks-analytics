import { z } from "zod";
import reference from "./lineage-reference.json" with { type: "json" };

const safeText = z
  .string()
  .max(20000)
  .refine(
    (s) =>
      !/(?:<[^>]+>|\{[{%]|\b(?:select|insert|delete|drop|update)\s+\S+|[a-z]:[\\/]|\/(?:Users|home|tmp|private|etc)\/|file:\/\/|-----BEGIN|(?:password|secret|api[_-]?key|token)\s*[=:])/i.test(
        s,
      ),
    "Unsafe metadata",
  );
const identifier = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const definitions = [
  "Grain uniqueness",
  "Not-null constraint",
  "Relationship constraint",
  "Unique constraint",
  "Dimension grain checks",
  "Dimension relationship checks",
  "Fact grain checks",
  "Financial reconciliation checks",
  "Sales mart reconciliation checks",
  "Row-count reconciliation checks",
];
const testSchema = z.strictObject({
  id: safeText.refine((s) => s.startsWith("test.adventureworks.")),
  definition: z.enum(definitions),
  column: identifier.nullable(),
  arguments: z.strictObject({
    column_name: identifier.optional(),
    field: identifier.optional(),
    keys: z.array(identifier).optional(),
  }),
  related_nodes: z.array(z.string()),
  scope: z.enum([
    "Within this focused graph.",
    "May also check resources outside this focused graph.",
  ]),
});
export const lineageSchema = z
  .strictObject({
    schema_version: z.literal(1),
    target: z.literal(reference.target),
    scope: z.literal(
      "Ancestors of mart_sales_summary only; test definitions are not execution results.",
    ),
    context: z.tuple([
      z.literal("SQL Server read-only extraction"),
      z.literal("validated Parquet snapshots"),
      z.literal("declared raw DuckDB tables"),
    ]),
    content_sha256: hash,
    provenance: z.strictObject({
      generated_at: z
        .string()
        .refine(
          (s) => /(?:\+00:00|Z)$/.test(s) && Number.isFinite(Date.parse(s)),
        ),
      source_revision: z.string().regex(/^[a-f0-9]{40}$/),
      dbt_source_sha256: hash,
      manifest_sha256: hash,
      database_sha256: hash,
      evidence_sha256: hash,
      snapshot_id: safeText,
      input_fingerprint: hash,
      versions: z.strictObject({
        "dbt-core": z.literal("1.12.5"),
        "dbt-duckdb": z.literal("1.11.0"),
        duckdb: z.literal("1.5.6"),
      }),
    }),
    nodes: z
      .array(
        z.strictObject({
          id: z.string(),
          name: identifier,
          kind: z.enum(["model", "source"]),
          description: safeText,
          materialization: z
            .enum(["view", "table", "incremental", "ephemeral"])
            .nullable(),
          columns: z.array(
            z.strictObject({
              name: identifier,
              type: safeText.max(100),
              description: safeText,
            }),
          ),
          tests: z.array(testSchema),
        }),
      )
      .length(8),
    edges: z
      .array(z.strictObject({ source: z.string(), target: z.string() }))
      .length(9),
  })
  .superRefine((doc, ctx) => {
    const fail = (message) => ctx.addIssue({ code: "custom", message });
    if (
      JSON.stringify(
        doc.nodes.map(({ id, name, kind }) => ({ id, name, kind })),
      ) !== JSON.stringify(reference.nodes)
    )
      fail("Unexpected nodes");
    if (JSON.stringify(doc.edges) !== JSON.stringify(reference.edges))
      fail("Unexpected edges");
    const ids = new Set(doc.nodes.map((n) => n.id));
    for (const n of doc.nodes) {
      if ((n.kind === "source") !== (n.materialization === null))
        fail("Invalid materialization");
      if (
        new Set(n.columns.map((c) => c.name)).size !== n.columns.length ||
        new Set(n.tests.map((t) => t.id)).size !== n.tests.length
      )
        fail("Duplicate metadata");
      for (const t of n.tests)
        if (
          !t.related_nodes.includes(n.id) ||
          new Set(t.related_nodes).size !== t.related_nodes.length ||
          t.related_nodes.some((id) => !ids.has(id))
        )
          fail("Invalid test scope");
    }
  });
