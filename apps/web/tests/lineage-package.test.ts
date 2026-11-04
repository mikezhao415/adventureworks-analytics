// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  assertPackaging,
  assertClientAssets,
  validatePackagingInputs,
  inspectOutputFile,
} from "../scripts/lineage-package-policy.mjs";
import {
  canonical,
  validateApprovedLineage,
} from "../lib/lineage-validation.mjs";
import fixture from "./fixtures/lineage.json";

const roots: string[] = [];
const hash = (raw: Buffer | string) =>
  createHash("sha256").update(raw).digest("hex");
function put(root: string, name: string, value: string | Buffer) {
  const p = path.join(root, name);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, value);
}
function setup() {
  const root = mkdtempSync(path.join(tmpdir(), "aw-lineage-package-"));
  roots.push(root);
  for (const name of [
    "custom-lineage-dependencies.txt",
    "microsoft-sql-server-samples.txt",
  ])
    put(root, "public/notices/" + name, readFileSync("public/notices/" + name));
  put(
    root,
    "data/lineage/approval.json",
    JSON.stringify({
      schema_version: 1,
      publication_approved: false,
      sha256: null,
      content_sha256: null,
      review_reference: null,
    }),
  );
  return root;
}
function contentHash(doc: typeof fixture) {
  const { content_sha256, ...rest } = doc;
  void content_sha256;
  const { generated_at, ...provenance } = rest.provenance;
  void generated_at;
  return hash(canonical({ ...rest, provenance }));
}
function positive(root: string, doc = structuredClone(fixture)) {
  doc.content_sha256 = contentHash(doc);
  const raw = Buffer.from(canonical(doc) + "\n");
  const pin = {
    schema_version: 1,
    publication_approved: true,
    sha256: hash(raw),
    content_sha256: doc.content_sha256,
    review_reference: "FICTIONAL TEMPORARY TEST ONLY",
  };
  put(root, "data/lineage/sales.json", raw);
  put(root, "data/lineage/approval.json", JSON.stringify(pin));
  return { raw, pin };
}
afterEach(() => {
  for (const folder of roots.splice(0)) {
    if (
      path.dirname(folder) !== tmpdir() ||
      !path.basename(folder).startsWith("aw-lineage-package-")
    )
      throw new Error("Unsafe temporary cleanup");
    rmSync(folder, { recursive: true, force: true });
  }
});

describe("F1 reviewed public assets", () => {
  it("preserves both exact Git-LF and existing Windows-CRLF notice forms", () => {
    const root = setup();
    const raw = readFileSync(
      "public/notices/microsoft-sql-server-samples.txt",
      "utf8",
    );
    put(
      root,
      "public/notices/microsoft-sql-server-samples.txt",
      raw.replace(/\r\n/g, "\n"),
    );
    expect(() => assertPackaging(root)).not.toThrow();
  });
  it("accepts only the exact legitimate notice inventory", () => {
    expect(() => assertPackaging(setup())).not.toThrow();
  });
  for (const name of [
    "graph-data.json",
    "unexpected.txt",
    "dbt/sales/index.html",
    "renamed.woff",
    "manifest.json",
    "catalog.json",
    "renamed.js",
    "hidden.bin",
  ]) {
    it("rejects unexpected public asset " + name, () => {
      const root = setup();
      put(root, "public/" + name, JSON.stringify(fixture));
      expect(() => assertPackaging(root)).toThrow(/inventory/);
    });
  }
  it("rejects modified approved paths even with unchanged filenames", () => {
    const root = setup();
    put(root, "public/notices/custom-lineage-dependencies.txt", "changed");
    expect(() => assertPackaging(root)).toThrow(/Changed reviewed/);
  });
  it("rejects unreviewed JSON imports regardless of source filename", () => {
    const root = setup();
    put(
      root,
      "components/copy.tsx",
      'import data from "../data/graph-data.json"; export default function Copy(){return <div>{JSON.stringify(data)}</div>}',
    );
    expect(() => assertPackaging(root)).toThrow(
      /Unreviewed application metadata import/,
    );
  });
});

describe("F1 emitted client/server output", () => {
  it("rejects unexpected traced data even under an innocuous filename", () => {
    const root = setup();
    put(root, ".next/static/chunks/a.js", "globalThis.x=1;");
    const trace = path.join(root, ".next/server/app/lineage/page.js.nft.json");
    put(
      root,
      path.relative(root, trace),
      JSON.stringify({
        files: [
          path.relative(
            path.dirname(trace),
            path.join(root, "data/graph-data.json"),
          ),
        ],
      }),
    );
    expect(() => assertPackaging(root, true)).toThrow(/Unexpected traced data/);
  });
  it("preserves only the exact previously published favicon bytes", () => {
    const root = setup();
    put(
      root,
      ".next/static/media/icon.any-name.svg",
      readFileSync("app/icon.svg"),
    );
    expect(() => assertClientAssets(root)).not.toThrow();
    put(root, ".next/static/media/icon.any-name.svg", "<svg>changed</svg>");
    expect(() => assertClientAssets(root)).toThrow(
      /Unexpected emitted client asset/,
    );
  });
  it("detects structured metadata in a cached response body regardless of suffix", () => {
    const root = setup(),
      file = path.join(root, "arbitrary.body");
    put(root, "arbitrary.body", JSON.stringify(fixture));
    expect(() => inspectOutputFile(file)).toThrow(
      /Embedded unpublished metadata/,
    );
  });
  it("detects serialized metadata inside HTML script payloads", () => {
    const root = setup(),
      file = path.join(root, "arbitrary.html");
    put(
      root,
      "arbitrary.html",
      "<script>self.__next_f.push([1," +
        JSON.stringify(JSON.stringify(fixture)) +
        "]);</script>",
    );
    expect(() => inspectOutputFile(file)).toThrow(
      /Embedded unpublished metadata/,
    );
  });
  it("detects metadata objects with hoisted property values", () => {
    const root = setup();
    put(
      root,
      ".next/static/chunks/a.js",
      "const nodes=[],edges=[],provenance={};globalThis.x={nodes,edges,provenance};",
    );
    expect(() => assertClientAssets(root)).toThrow(
      /Embedded unpublished metadata/,
    );
  });
  it("detects renamed metadata in actual JS objects rather than signatures", () => {
    const root = setup();
    put(
      root,
      ".next/static/chunks/arbitrary.js",
      "globalThis.innocent=" + JSON.stringify(fixture) + ";",
    );
    expect(() => assertClientAssets(root)).toThrow(
      /Embedded unpublished metadata/,
    );
  });
  it("detects escaped serialized JSON in JS strings", () => {
    const root = setup();
    put(
      root,
      ".next/static/chunks/arbitrary.js",
      "globalThis.innocent=JSON.parse(" +
        JSON.stringify(JSON.stringify(fixture)) +
        ");",
    );
    expect(() => assertClientAssets(root)).toThrow(
      /Embedded unpublished metadata/,
    );
  });
  it("detects a full manifest without relying on its filename", () => {
    const root = setup();
    put(
      root,
      ".next/static/chunks/a.js",
      "globalThis.x={metadata:{},nodes:{},sources:{},macros:{}};",
    );
    expect(() => assertClientAssets(root)).toThrow(
      /Embedded unpublished metadata/,
    );
  });
  it("rejects arbitrary data assets rather than treating them as generated JS/CSS", () => {
    const root = setup();
    put(root, ".next/static/chunks/graph-data.json", JSON.stringify(fixture));
    expect(() => assertClientAssets(root)).toThrow(
      /Unexpected emitted client asset/,
    );
  });
  it("detects metadata in CSS comments and JSON data URLs", () => {
    for (const text of [
      "/* " + JSON.stringify(fixture) + " */",
      "a{background:url(data:application/json;base64," +
        Buffer.from(JSON.stringify(fixture)).toString("base64") +
        ")}",
    ]) {
      const root = setup();
      put(root, ".next/static/chunks/a.css", text);
      expect(() => assertClientAssets(root)).toThrow(
        /Embedded unpublished metadata/,
      );
    }
  });
  it("scans relevant server output too", () => {
    const root = setup();
    put(root, ".next/static/chunks/a.js", "globalThis.x=1;");
    put(
      root,
      ".next/server/chunks/arbitrary.js",
      "globalThis.x=" + JSON.stringify(fixture),
    );
    expect(() => assertPackaging(root, true)).toThrow(
      /Embedded unpublished metadata/,
    );
  });
  it("allows legitimate generated JS/CSS and schema-construction calls", () => {
    const root = setup();
    put(
      root,
      ".next/static/chunks/a.js",
      "const schema={nodes:z.array(node),edges:z.array(edge),provenance:z.object(p),content_sha256:hash};",
    );
    put(root, ".next/static/chunks/a.css", ".graph{color:green}");
    expect(() => assertClientAssets(root)).not.toThrow();
  });
});

describe("F2 complete shared approval contract before packaging", () => {
  it("accepts the same fictional exact bytes in preflight and runtime", () => {
    const root = setup(),
      { raw, pin } = positive(root);
    expect(validatePackagingInputs(root)).toEqual(
      validateApprovedLineage(raw, pin),
    );
  });
  const cases: [
    string,
    (doc: typeof fixture, pin: ReturnType<typeof positive>["pin"]) => void,
    boolean?,
  ][] = [
    [
      "extra SQL field",
      (doc) => {
        Object.assign(doc, { raw_code: "select PRIVATE from example" });
      },
      true,
    ],
    [
      "stale semantic hash",
      (doc) => {
        doc.nodes[0].description = "Changed safe description";
      },
    ],
    [
      "unsupported approval version",
      (_, pin) => {
        pin.schema_version = 999;
      },
    ],
    [
      "whitespace review reference",
      (_, pin) => {
        pin.review_reference = "   ";
      },
    ],
    [
      "false approval",
      (_, pin) => {
        pin.publication_approved = false;
      },
    ],
    [
      "unknown approval field",
      (_, pin) => {
        Object.assign(pin, { extra: true });
      },
    ],
    [
      "unexpected node",
      (doc) => {
        doc.nodes[0].id = "model.adventureworks.unexpected";
      },
      true,
    ],
    [
      "unexpected edge",
      (doc) => {
        doc.edges[0].source = "model.adventureworks.unexpected";
      },
      true,
    ],
    [
      "duplicate edge",
      (doc) => {
        doc.edges[0] = doc.edges[1];
      },
      true,
    ],
  ];
  for (const [name, mutate, recompute] of cases)
    it("rejects " + name + " before traces exist", () => {
      const root = setup(),
        doc = structuredClone(fixture),
        { pin } = positive(root);
      mutate(doc, pin);
      if (recompute) {
        doc.content_sha256 = contentHash(doc);
        pin.content_sha256 = doc.content_sha256;
      }
      const raw = Buffer.from(canonical(doc) + "\n");
      pin.sha256 = hash(raw);
      put(root, "data/lineage/sales.json", raw);
      put(root, "data/lineage/approval.json", JSON.stringify(pin));
      expect(() => assertPackaging(root)).toThrow();
      expect(existsSync(path.join(root, ".next"))).toBe(false);
    });
  for (const [name, transform] of [
    ["malformed", () => "{"],
    ["noncanonical", () => JSON.stringify(fixture, null, 2)],
    [
      "duplicate JSON keys",
      () =>
        canonical(fixture).replace(
          '"schema_version":1',
          '"schema_version":1,"schema_version":1',
        ),
    ],
  ] as const)
    it("rejects " + name + " artifact despite updated file pin", () => {
      const root = setup(),
        { pin } = positive(root),
        raw = Buffer.from(transform());
      pin.sha256 = hash(raw);
      put(root, "data/lineage/sales.json", raw);
      put(root, "data/lineage/approval.json", JSON.stringify(pin));
      expect(() => assertPackaging(root)).toThrow();
    });
  it("rejects unsupported pending approval even without an artifact", () => {
    const root = setup();
    put(
      root,
      "data/lineage/approval.json",
      '{"schema_version":999,"publication_approved":false,"sha256":null,"content_sha256":null,"review_reference":null}',
    );
    expect(() => assertPackaging(root)).toThrow();
  });
  it("rejects approval true when the artifact is missing", () => {
    const root = setup(),
      { pin } = positive(setup());
    put(root, "data/lineage/approval.json", JSON.stringify(pin));
    expect(() => assertPackaging(root)).toThrow(/missing/);
  });
  it("enforces the shared validator through the actual CLI entry point", () => {
    const root = setup();
    put(root, "data/lineage/sales.json", JSON.stringify(fixture));
    expect(() =>
      execFileSync(
        process.execPath,
        [path.resolve("scripts/check-lineage-package.mjs")],
        { cwd: root, stdio: "pipe" },
      ),
    ).toThrow();
  });
});
