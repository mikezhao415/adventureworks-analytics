import { z } from "zod";
import reference from "./lineage-reference.json";
import { lineageSchema } from "./lineage-schema.mjs";
export { lineageSchema };

export type Lineage = z.infer<typeof lineageSchema>;
export type Mode = "all" | "upstream" | "downstream";
export const target = reference.target;
export function parseLineageQuery(query: URLSearchParams) {
  const node = query.get("node") ?? target,
    mode = query.get("mode") ?? "all";
  const invalid =
    [...query.keys()].some((k) => !["node", "mode"].includes(k)) ||
    query.getAll("node").length > 1 ||
    query.getAll("mode").length > 1 ||
    !reference.nodes.some((n) => n.id === node) ||
    !["all", "upstream", "downstream"].includes(mode);
  return {
    node: invalid ? target : node,
    mode: (invalid ? "all" : mode) as Mode,
    invalid,
  };
}
export function highlighted(
  doc: Pick<Lineage, "nodes" | "edges">,
  selected: string,
  mode: Mode,
) {
  if (mode === "all") return new Set(doc.nodes.map((n) => n.id));
  const found = new Set([selected]),
    pending = [selected];
  while (pending.length) {
    const id = pending.pop();
    for (const e of doc.edges) {
      const next =
        mode === "upstream"
          ? e.target === id
            ? e.source
            : null
          : e.source === id
            ? e.target
            : null;
      if (next && !found.has(next)) {
        found.add(next);
        pending.push(next);
      }
    }
  }
  return found;
}
