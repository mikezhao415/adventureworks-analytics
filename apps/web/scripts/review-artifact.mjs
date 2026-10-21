// Local artifact audit and real production-loader negative path; never edits the candidate.
import {
  readFile,
  mkdir,
  mkdtemp,
  writeFile,
  unlink,
  rmdir,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { createServer } from "vite";

const root = process.cwd();
const hash = (raw) => createHash("sha256").update(raw).digest("hex");
const candidate = path.join(root, "data/adventureworks2022.json");
const original = await readFile(candidate);
assert.deepEqual(original, await readFile("../../output/dashboard/data.json"));
const manifest = JSON.parse(
  await readFile("../../docs/dashboard-artifact-review.json", "utf8"),
);
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
});
let sandbox;
try {
  const { validatePublicArtifact, validateDocument, PUBLIC_ARTIFACT } =
    await server.ssrLoadModule("/lib/data.ts");
  const { GET } = await server.ssrLoadModule("/app/api/dashboard/route.ts");
  const doc = validatePublicArtifact(original);
  for (const field of ["bytes", "sha256", "content_sha256"])
    assert.equal(manifest[field], PUBLIC_ARTIFACT[field]);
  assert.equal(manifest.bytes, original.length);
  assert.equal(manifest.sha256, hash(original));
  assert.deepEqual(manifest.provenance, doc.provenance);
  assert.deepEqual(manifest.period, doc.data.period);
  const keys = (value, expected) =>
    assert.deepEqual(Object.keys(value).sort(), expected.split(",").sort());
  const raw = JSON.parse(original);
  keys(raw, "version,content_sha256,provenance,data");
  keys(
    raw.provenance,
    "mode,snapshot_id,input_fingerprint,source_extracted_at,analytics_revision,export_revision,working_tree_dirty,reconciliation",
  );
  keys(
    raw.provenance.reconciliation,
    "mart_sales_summary,mart_sales_monthly,mart_sales_customer,mart_sales_territory,mart_sales_product,mart_sales_category",
  );
  for (const control of Object.values(raw.provenance.reconciliation))
    keys(control, "result,rows");
  keys(raw.data, "period,customers,products,categories,dimensions");
  keys(raw.data.period, "start,end");
  keys(raw.data.dimensions, "territories,categories,products");
  const common = "date,territory_key,order_count,units_sold,net_line_sales";
  for (const [section, suffix] of [
    ["customers", "customer_key,header_subtotal,tax,freight,total_due"],
    ["products", "product_key"],
    ["categories", "category_key"],
  ]) {
    assert.equal(raw.data[section].length, manifest.cells[section]);
    for (const row of raw.data[section]) {
      keys(row, common + "," + suffix);
      assert(
        row.date >= manifest.period.start && row.date <= manifest.period.end,
      );
    }
  }
  for (const [section, rows] of Object.entries(raw.data.dimensions)) {
    assert.equal(rows.length, manifest.dimensions[section]);
    for (const row of rows)
      keys(row, section === "products" ? "key,name,category_key" : "key,name");
  }
  const suspicious =
    /https?:|data:|[<>@]|password|secret|bearer\s|BEGIN.*PRIVATE KEY/i;
  const strings = [];
  function scan(value) {
    if (typeof value === "string") strings.push(value);
    else if (value && typeof value === "object")
      Object.values(value).forEach(scan);
  }
  scan(raw);
  assert.equal(strings.filter((s) => suspicious.test(s)).length, 0);
  const fixtureRaw = await readFile("data/demo.json", "utf8");
  const trackedFixture = execFileSync(
    "git",
    ["show", "HEAD:apps/web/data/demo.json"],
    { encoding: "utf8" },
  );
  assert.equal(
    fixtureRaw.replaceAll("\r\n", "\n"),
    trackedFixture.replaceAll("\r\n", "\n"),
  );
  assert.equal(
    validateDocument(JSON.parse(fixtureRaw)).provenance.mode,
    "offline_fixture",
  );
  const output = path.resolve("../../output/dashboard");
  await mkdir(output, { recursive: true });
  sandbox = await mkdtemp(path.join(output, "audit-sandbox-"));
  await mkdir(path.join(sandbox, "data"));
  const file = path.join(sandbox, "data", PUBLIC_ARTIFACT.file);
  await writeFile(file, original);
  process.env.NODE_ENV = "production";
  process.env.AW_DASHBOARD_DATA = path.join(root, "data/demo.json");
  process.chdir(sandbox);
  const request = () => GET(new Request("http://localhost/api/dashboard"));
  assert.equal((await request()).status, 200);
  // Valid JSON, same byte length, one financial digit changed; keep the source untouched.
  const altered = Buffer.from(original);
  const marker = '"net_line_sales":"';
  const offset = altered.indexOf(marker) + marker.length;
  assert(offset >= marker.length);
  altered[offset] = altered[offset] === 48 ? 49 : 48;
  JSON.parse(altered);
  await writeFile(file, altered);
  assert.equal((await request()).status, 503);
  await unlink(file);
  assert.equal((await request()).status, 503);
  await writeFile(file, original);
  assert.equal((await request()).status, 200);
  process.chdir(root);
  assert.deepEqual(await readFile(candidate), original);
  const report = {
    result: "pass",
    mode: doc.provenance.mode,
    code_revision: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    working_tree_dirty: Boolean(
      execFileSync("git", ["status", "--porcelain"], {
        encoding: "utf8",
      }).trim(),
    ),
    environment: { node: process.version, platform: process.platform },
    artifact_sha256: hash(original),
    content_sha256: doc.content_sha256,
    snapshot_id: doc.provenance.snapshot_id,
    manifest_identity: "match",
    unexpected_fields: 0,
    suspicious_string_matches: 0,
    fixture_unchanged: true,
    candidate_unchanged: true,
    production_route_statuses: {
      exact: 200,
      altered_after_warm_load: 503,
      absent_after_warm_load: 503,
      restored: 200,
    },
    altered_sha256: hash(altered),
    altered_bytes: altered.length,
    limitations: [
      "Schema allowlist and string-pattern checks are content review aids, not anonymization or legal clearance",
      "Production route/loader executed through local Vite harness in isolated directory; not a hosted deployment",
    ],
  };
  await writeFile(
    path.join(output, "artifact-audit.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  process.chdir(root);
  if (sandbox) {
    await unlink(path.join(sandbox, "data/adventureworks2022.json")).catch(
      () => {},
    );
    await rmdir(path.join(sandbox, "data")).catch(() => {});
    await rmdir(sandbox).catch(() => {});
  }
  await server.close();
}
