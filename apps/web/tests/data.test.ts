import { describe, it, expect, vi, afterEach } from "vitest";
import { writeFile, mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import demo from "../data/demo.json";
import {
  dashboard,
  loadDocument,
  PUBLIC_ARTIFACT,
  validatePublicArtifact,
  validateDocument,
  validateFilter,
  stableJson,
  summarize,
} from "../lib/data";
import type { DashboardDocument } from "../lib/schema";
import { money } from "../lib/format";
function example(): DashboardDocument {
  const data: DashboardDocument["data"] = {
    period: { start: "2014-01-01", end: "2014-01-02" },
    dimensions: {
      territories: [
        { key: 1, name: "North" },
        { key: 2, name: "South" },
      ],
      categories: [
        { key: 1, name: "Bikes" },
        { key: 2, name: "Parts" },
      ],
      products: [
        { key: 1, name: "Bike", category_key: 1 },
        { key: 2, name: "Pedal", category_key: 2 },
      ],
    },
    customers: [
      {
        date: "2014-01-01",
        territory_key: 1,
        customer_key: 1,
        order_count: 1,
        units_sold: 3,
        net_line_sales: "10.000001",
        header_subtotal: "10.0000",
        tax: "1.0000",
        freight: "0.0000",
        total_due: "11.0000",
      },
      {
        date: "2014-01-02",
        territory_key: 2,
        customer_key: 2,
        order_count: 2,
        units_sold: 5,
        net_line_sales: "20.000002",
        header_subtotal: "20.0001",
        tax: "2.0000",
        freight: "0.0000",
        total_due: "22.0001",
      },
    ],
    products: [
      {
        date: "2014-01-01",
        territory_key: 1,
        product_key: 1,
        order_count: 1,
        units_sold: 1,
        net_line_sales: "4.000000",
      },
      {
        date: "2014-01-01",
        territory_key: 1,
        product_key: 2,
        order_count: 1,
        units_sold: 2,
        net_line_sales: "6.000001",
      },
      {
        date: "2014-01-02",
        territory_key: 2,
        product_key: 1,
        order_count: 2,
        units_sold: 5,
        net_line_sales: "20.000002",
      },
    ],
    categories: [
      {
        date: "2014-01-01",
        territory_key: 1,
        category_key: 1,
        order_count: 1,
        units_sold: 1,
        net_line_sales: "4.000000",
      },
      {
        date: "2014-01-01",
        territory_key: 1,
        category_key: 2,
        order_count: 1,
        units_sold: 2,
        net_line_sales: "6.000001",
      },
      {
        date: "2014-01-02",
        territory_key: 2,
        category_key: 1,
        order_count: 2,
        units_sold: 5,
        net_line_sales: "20.000002",
      },
    ],
  };
  return {
    ...demo,
    data,
    content_sha256: createHash("sha256").update(stableJson(data)).digest("hex"),
  } as DashboardDocument;
}
describe("validated dashboard boundary", () => {
  it("accepts the exported demo and rejects changed content", () => {
    expect(validateDocument(demo).provenance.mode).toBe("offline_fixture");
    const bad = structuredClone(demo);
    bad.data.customers[0].net_line_sales = "999.000000";
    expect(() => validateDocument(bad)).toThrow("checksum");
  });
  it("rejects a duplicate cell even if the checksum is recalculated", () => {
    const bad = example();
    bad.data.customers.push(bad.data.customers[0]);
    bad.content_sha256 = createHash("sha256")
      .update(stableJson(bad.data))
      .digest("hex");
    expect(() => validateDocument(bad)).toThrow("Duplicate dashboard cell");
  });
  it("rejects schema drift and missing relationships", () => {
    const bad = example();
    bad.data.products[0].net_line_sales = "4.0000001";
    expect(() => validateDocument(bad)).toThrow();
    const orphan = example();
    orphan.data.dimensions.products = [];
    orphan.content_sha256 = createHash("sha256")
      .update(stableJson(orphan.data))
      .digest("hex");
    expect(() => validateDocument(orphan)).toThrow("Missing product dimension");
  });
  it("sums disjoint cells without adding product order counts to the overview", () => {
    const d = dashboard(validateDocument(example()));
    expect(d.summary).toMatchObject({
      order_count: 3,
      units_sold: 8,
      net_line_sales: "30.000003",
      average_order_value: "10.0000",
    });
    expect(d.products.reduce((s, p) => s + p.order_count, 0)).toBe(4);
    expect(d.customers[0].name).toBe("Customer 00002");
    expect(d.territories[0].net_line_sales).toBe("20.000002");
    expect(d.monthly[0].net_line_sales).toBe("30.000003");
  });
  it("includes exact day boundaries and combines date, territory and category safely", () => {
    const d = dashboard(example(), {
      start: "2014-01-01",
      end: "2014-01-01",
      territory: "1",
      category: "2",
    });
    expect(d.summary.order_count).toBe(1);
    expect(d.summary.net_line_sales).toBe("10.000001");
    expect(d.products.map((p) => p.name)).toEqual(["Pedal"]);
    expect(d.categories[0].net_line_sales).toBe("6.000001");
    expect(d.customers[0].net_line_sales).toBe("10.000001");
  });
  it("does not propagate a category selection to header-based metrics", () => {
    const all = dashboard(example()),
      filtered = dashboard(example(), { category: "2" });
    expect(filtered.summary).toEqual(all.summary);
    expect(filtered.monthly).toEqual(all.monthly);
    expect(filtered.territories).toEqual(all.territories);
    expect(filtered.customers).toEqual(all.customers);
    expect(filtered.products).toHaveLength(1);
  });
  it("returns honest empty measures for no matching dates or territory intersection", () => {
    const d = dashboard(example(), { start: "2015-01-01", end: "2015-01-01" });
    expect(d.summary.order_count).toBe(0);
    expect(d.summary.average_order_value).toBeNull();
    expect(d.monthly).toEqual([]);
    expect(
      dashboard(example(), {
        start: "2014-01-01",
        end: "2014-01-01",
        territory: "2",
      }).summary.order_count,
    ).toBe(0);
  });
  it("rejects malformed, reversed, unknown and impossible filters", () => {
    for (const query of [
      { start: "2014-02-30" },
      { start: "" },
      { end: "" },
      { start: "2014-02-01", end: "2014-01-01" },
      { territory: "999" },
      { category: "999" },
      { sql: "select 1" },
    ] as Record<string, string>[])
      expect(() => validateFilter(query, example())).toThrow();
  });
  it("rounds AOV and displayed amounts halfway away from zero without floating point", () => {
    expect(
      summarize([
        {
          order_count: 2,
          units_sold: 1,
          net_line_sales: "2.000000",
          header_subtotal: "2.0001",
        },
      ]).average_order_value,
    ).toBe("1.0001");
    expect(money("999.995000", 2)).toBe("1,000.00");
    expect(money("9007199254740993.123456")).toBe(
      "9,007,199,254,740,993.123456",
    );
    expect(money(null)).toBe("—");
  });
});

import { scalarFilters, filterHref, PAGES } from "../lib/navigation";
describe("URL boundary and multi-selection", () => {
  it("isolates tracking parameters while retaining supported filters", () => {
    const doc = example();
    expect(dashboard(doc, scalarFilters({}))).toEqual(
      dashboard(
        doc,
        scalarFilters({ utm_source: "chatgpt.com", utm_campaign: ["a", "b"] }),
      ),
    );
    expect(
      scalarFilters({ utm_source: "x", territory: "1,2", category: "2" }),
    ).toEqual({ territory: "1,2", category: "2" });
    expect(() =>
      dashboard(doc, scalarFilters({ utm_source: "x", start: "bad" })),
    ).toThrow();
    expect(() =>
      scalarFilters({ start: ["2014-01-01", "2014-01-02"] }),
    ).toThrow();
  });
  it("composes unions of disjoint territories and limits categories to product views", () => {
    const all = dashboard(example()),
      multi = dashboard(example(), { territory: "1,2", category: "1,2" });
    expect(multi.summary).toEqual(all.summary);
    expect(multi.category_net_line_sales).toBe("30.000003");
    expect(multi.products).toEqual(all.products);
    const scoped = dashboard(example(), { territory: "1,2", category: "2" });
    expect(scoped.summary).toEqual(all.summary);
    expect(scoped.categories).toHaveLength(1);
    expect(scoped.category_net_line_sales).toBe("6.000001");
    expect(scoped.products[0].name).toBe("Pedal");
    for (const territory of ["", "1,", "1,1", "all,1", "1,999"])
      expect(() => dashboard(example(), { territory })).toThrow();
    for (const category of ["", "1,", "1,1", "all,1", "1,999"])
      expect(() => dashboard(example(), { category })).toThrow();
  });
  it("uses consistent navigation titles and serializes multi-selections", () => {
    expect(PAGES.map((p) => p.title)).toEqual([
      "Sales Overview",
      "Sales Trends",
      "Products & Categories",
      "Customers",
      "Territory Performance",
      "Data & Definitions",
      "Filters",
    ]);
    expect(
      filterHref("/products", {
        start: "2014-01-01",
        end: "2014-01-02",
        territory: "1,2",
        category: "all",
      }),
    ).toContain("territory=1%2C2");
  });
});

describe("production publication artifact boundary", () => {
  const pins = { ...PUBLIC_ARTIFACT };
  // Small fictional content exercises each policy branch without a source dataset in CI.
  function candidate() {
    const doc = structuredClone(demo);
    doc.provenance.mode = "real_adventureworks";
    doc.provenance.snapshot_id = pins.snapshot_id;
    return doc;
  }
  function pin(raw: Buffer) {
    Object.assign(PUBLIC_ARTIFACT, {
      bytes: raw.length,
      sha256: createHash("sha256").update(raw).digest("hex"),
      content_sha256: demo.content_sha256,
    });
  }
  it("accepts exact pinned bytes and rejects byte tampering", () => {
    const raw = Buffer.from(JSON.stringify(candidate()));
    pin(raw);
    expect(validatePublicArtifact(raw).provenance.mode).toBe(
      "real_adventureworks",
    );
    expect(() =>
      validatePublicArtifact(Buffer.concat([raw, Buffer.from(" ")])),
    ).toThrow("file checksum");
    const corrupt = Buffer.from(raw);
    corrupt[0] = 32;
    expect(() => validatePublicArtifact(corrupt)).toThrow("file checksum");
  });
  it.each(["mode", "snapshot", "content", "internal"])(
    "rejects wrong %s even with matching file pin",
    (field) => {
      const doc = candidate();
      if (field === "mode") doc.provenance.mode = "offline_fixture";
      if (field === "snapshot") doc.provenance.snapshot_id = "unexpected";
      if (field === "internal")
        doc.data.customers[0].net_line_sales = "0.000000";
      const raw = Buffer.from(JSON.stringify(doc));
      pin(raw);
      if (field === "content")
        Object.assign(PUBLIC_ARTIFACT, { content_sha256: "0".repeat(64) });
      expect(() => validatePublicArtifact(raw)).toThrow(
        field === "mode"
          ? "requires AdventureWorks"
          : field === "snapshot"
            ? "snapshot"
            : "checksum",
      );
    },
  );
  afterEach(() => {
    Object.assign(PUBLIC_ARTIFACT, pins);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("ignores an external data override in production", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "aw-dashboard-"));
    const externalFile = path.join(directory, "external.json");
    try {
      await writeFile(externalFile, "{ invalid JSON", "utf8");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("AW_DASHBOARD_DATA", externalFile);
      const raw = Buffer.from(JSON.stringify(candidate()));
      pin(raw);
      await mkdir(path.join(directory, "data"));
      await writeFile(path.join(directory, "data", PUBLIC_ARTIFACT.file), raw);
      vi.spyOn(process, "cwd").mockReturnValue(directory);
      const document = await loadDocument();
      expect(document.provenance.mode).toBe("real_adventureworks");
      expect(document.content_sha256).toBe(demo.content_sha256);
      expect(Object.isFrozen(document.data.customers[0])).toBe(true);
      expect(() => {
        document.data.customers[0].net_line_sales = "0.000000";
      }).toThrow();
      // Cached validation must never conceal changed or missing packaged bytes.
      await writeFile(
        path.join(directory, "data", PUBLIC_ARTIFACT.file),
        "tampered",
      );
      await expect(loadDocument()).rejects.toThrow("file checksum");
      await rm(path.join(directory, "data", PUBLIC_ARTIFACT.file));
      await expect(loadDocument()).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails closed when the fixed production file is absent", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "aw-missing-"));
    try {
      vi.spyOn(process, "cwd").mockReturnValue(directory);
      vi.stubEnv("NODE_ENV", "production");
      const external = path.join(directory, "external.json");
      await writeFile(external, JSON.stringify(demo));
      vi.stubEnv("AW_DASHBOARD_DATA", external);
      await expect(loadDocument()).rejects.toThrow();
    } finally {
      vi.restoreAllMocks();
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("retains explicit local fixture override for development", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "aw-dashboard-"));
    const externalFile = path.join(directory, "external.json");
    try {
      await writeFile(externalFile, "{ invalid JSON", "utf8");
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("AW_DASHBOARD_DATA", externalFile);
      await expect(loadDocument()).rejects.toThrow(SyntaxError);
      const local = structuredClone(demo);
      local.provenance.snapshot_id = "fictional-development-override";
      await writeFile(externalFile, JSON.stringify(local), "utf8");
      expect((await loadDocument()).provenance.snapshot_id).toBe(
        "fictional-development-override",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects unapproved bytes at the production artifact path", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "aw-dashboard-"));
    try {
      const mislabeled = structuredClone(demo);
      // Fictional content only: exercise the provenance guard without real data.
      mislabeled.provenance.mode = "real_adventureworks";
      expect(validateDocument(mislabeled).provenance.mode).toBe(
        "real_adventureworks",
      );
      await mkdir(path.join(directory, "data"));
      await writeFile(
        path.join(directory, "data", PUBLIC_ARTIFACT.file),
        JSON.stringify(mislabeled),
      );
      vi.spyOn(process, "cwd").mockReturnValue(directory);
      vi.stubEnv("NODE_ENV", "production");
      await expect(loadDocument()).rejects.toThrow(
        "Unapproved dashboard file checksum",
      );
    } finally {
      vi.restoreAllMocks();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
