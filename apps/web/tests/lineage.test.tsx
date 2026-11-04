import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import fixture from "./fixtures/lineage.json";
import {
  lineageSchema,
  highlighted,
  parseLineageQuery,
  target,
} from "../lib/lineage";
import {
  canonical,
  loadLineage,
  validateApprovedLineage,
} from "../lib/lineage-server";
import { preserveQuery } from "../lib/navigation";
import { GraphBoundary } from "../components/lineage-viewer";

const doc = lineageSchema.parse(fixture);
const sha = (raw: Buffer | string) =>
  createHash("sha256").update(raw).digest("hex");
const raw = Buffer.from(canonical(doc) + "\n");
const approval = {
  schema_version: 1,
  publication_approved: true,
  sha256: sha(raw),
  content_sha256: doc.content_sha256,
  review_reference: "Fictional test-only approval",
};
describe("custom lineage publication boundary", () => {
  it("accepts only the exact explicitly approved fictional bytes", () => {
    expect(validateApprovedLineage(raw, approval)).toEqual(doc);
    for (const change of [
      { publication_approved: false },
      { sha256: "0".repeat(64) },
      { content_sha256: "0".repeat(64) },
      { review_reference: "" },
    ])
      expect(() =>
        validateApprovedLineage(raw, { ...approval, ...change }),
      ).toThrow();
  });
  it("loads only the explicitly approved workspace bytes, without fixture fallback", async () => {
    const pin = JSON.parse(
      await readFile("data/lineage/approval.json", "utf8"),
    );
    if (!pin.publication_approved) {
      await expect(loadLineage()).rejects.toThrow();
    } else {
      const workspaceRaw = await readFile("data/lineage/sales.json");
      expect(sha(workspaceRaw)).toBe(pin.sha256);
      expect(await loadLineage()).toEqual(
        validateApprovedLineage(workspaceRaw, pin),
      );
    }
  });
  it("rejects duplicate JSON keys, unknown fields and sensitive metadata even with a new file pin", () => {
    const duplicate = Buffer.from(
      raw
        .toString()
        .replace('"schema_version":1', '"schema_version":1,"schema_version":1'),
    );
    expect(() =>
      validateApprovedLineage(duplicate, {
        ...approval,
        sha256: sha(duplicate),
      }),
    ).toThrow();
    for (const altered of [
      { ...doc, raw_code: "secret" },
      {
        ...doc,
        nodes: doc.nodes.map((n, i) =>
          i ? n : { ...n, description: "<script>alert(1)</script>" },
        ),
      },
    ]) {
      const changed = Buffer.from(canonical(altered) + "\n");
      expect(() =>
        validateApprovedLineage(changed, { ...approval, sha256: sha(changed) }),
      ).toThrow();
    }
  });
  it("rejects missing, duplicate and inferred topology", () => {
    for (const altered of [
      { ...doc, nodes: doc.nodes.slice(1) },
      { ...doc, nodes: [...doc.nodes.slice(1), doc.nodes[1]] },
      {
        ...doc,
        edges: doc.edges.map((e, i) => (i ? e : { ...e, source: target })),
      },
    ])
      expect(() => lineageSchema.parse(altered)).toThrow();
  });
  it("matches Python canonical hashes and excludes only generation time from content", () => {
    const { content_sha256, ...content } = doc;
    const { generated_at, ...provenance } = content.provenance;
    void generated_at;
    expect(sha(canonical({ ...content, provenance }))).toBe(content_sha256);
    const changed = {
      ...doc,
      provenance: {
        ...doc.provenance,
        generated_at: "2026-02-01T00:00:00+00:00",
      },
    };
    const bytes = Buffer.from(canonical(changed) + "\n");
    expect(
      validateApprovedLineage(bytes, { ...approval, sha256: sha(bytes) }),
    ).toEqual(changed);
  });
});
describe("lineage exploration state", () => {
  it("traverses ancestors and descendants without inventing edges", () => {
    expect(highlighted(doc, target, "upstream").size).toBe(8);
    expect([...highlighted(doc, target, "downstream")]).toEqual([target]);
    expect(
      highlighted(doc, "model.adventureworks.fct_sales_orders", "downstream")
        .size,
    ).toBe(3);
  });
  it("defaults invalid/duplicate parameters and isolates financial navigation", () => {
    expect(parseLineageQuery(new URLSearchParams())).toEqual({
      node: target,
      mode: "all",
      invalid: false,
    });
    for (const query of [
      "node=missing",
      "mode=bad",
      "node=a&node=b",
      "start=2026-01-01",
    ])
      expect(parseLineageQuery(new URLSearchParams(query)).invalid).toBe(true);
    expect(preserveQuery("/lineage", "start=2013-01-01")).toBe("/lineage");
    expect(preserveQuery("/products", "node=x&mode=all&start=2013-01-01")).toBe(
      "/products?start=2013-01-01",
    );
  });
  it("keeps a readable fallback when the graph throws", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    function Broken(): never {
      throw new Error("graph initialization failed");
    }
    render(
      <GraphBoundary>
        <Broken />
      </GraphBoundary>,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Use the node list and details",
    );
    error.mockRestore();
  });
});
