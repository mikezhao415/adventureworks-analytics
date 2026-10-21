// Measure the controlled local production server; never uploads or changes data.
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";

const phase = process.argv[2];
if (!["before", "after"].includes(phase))
  throw new Error("Choose before or after");
const base = "http://127.0.0.1:3100";
const api = await fetch(base + "/api/dashboard");
if (!api.ok) throw new Error("Production API unavailable");
const apiBytes = Buffer.from(await api.arrayBuffer());
const identity = JSON.parse(apiBytes);
if (identity.provenance.mode !== "real_adventureworks")
  throw new Error("Sample production server required");
const measurements = [];
for (const route of [
  "/",
  "/trends",
  "/products",
  "/customers",
  "/territories",
  "/filters",
  "/definitions",
]) {
  for (const kind of ["html", "rsc"]) {
    const start = performance.now();
    const response = await fetch(base + route, {
      headers: {
        "Accept-Encoding": "identity",
        ...(kind === "rsc" ? { RSC: "1" } : {}),
      },
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (
      !response.ok ||
      !(response.headers.get("content-type") || "").includes(
        kind === "rsc" ? "text/x-component" : "text/html",
      )
    )
      throw new Error("Unexpected page response");
    measurements.push({
      route,
      kind,
      bytes: bytes.length,
      gzip_bytes: gzipSync(bytes).length,
      ms: performance.now() - start,
    });
  }
}
const report = {
  phase,
  mode: identity.provenance.mode,
  code_revision: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  working_tree_dirty: Boolean(
    execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  ),
  environment: { node: process.version, platform: process.platform },
  snapshot_id: identity.provenance.snapshot_id,
  input_fingerprint: identity.provenance.input_fingerprint,
  api_bytes: apiBytes.length,
  api_sha256: createHash("sha256").update(apiBytes).digest("hex"),
  measurements,
  limitations: [
    "Local sequential production responses, OS cache uncontrolled",
    "Local gzip calculation; not CDN transfer sizes",
    "RSC header request, not a hosted browser-navigation benchmark",
  ],
};
await mkdir("../../output/dashboard", { recursive: true });
await writeFile(
  `../../output/dashboard/page-payloads-${phase}.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      phase,
      api_bytes: report.api_bytes,
      api_sha256: report.api_sha256,
      measurements,
    },
    null,
    2,
  ),
);
