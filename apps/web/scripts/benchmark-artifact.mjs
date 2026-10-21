// Local-only measurement of the exact candidate, never a data publication step.
import { createServer } from "vite";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";

const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
});
try {
  const { loadDocument, PUBLIC_ARTIFACT, dashboard } =
    await server.ssrLoadModule("/lib/data.ts");
  process.env.NODE_ENV = "production";
  process.env.AW_DASHBOARD_DATA = "benchmark-override-must-not-load.json";
  const samples = [];
  let doc;
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    doc = await loadDocument();
    if (doc.provenance.mode !== "real_adventureworks")
      throw new Error("Benchmark must use production sample loader");
    const validated = performance.now();
    const response = JSON.stringify(dashboard(doc));
    samples.push({
      load_validate_ms: validated - start,
      compose_serialize_ms: performance.now() - validated,
      response_bytes: Buffer.byteLength(response),
      response_gzip_bytes: gzipSync(response).length,
      rss_bytes: process.memoryUsage().rss,
    });
  }
  const tracePath = path.resolve(
    ".next/server/app/api/dashboard/route.js.nft.json",
  );
  const trace = JSON.parse(await readFile(tracePath, "utf8"));
  let traceBytes = 0;
  for (const file of new Set(trace.files))
    traceBytes += (await stat(path.resolve(path.dirname(tracePath), file)))
      .size;
  const report = {
    mode: doc.provenance.mode,
    code_revision: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    working_tree_dirty: Boolean(
      execFileSync("git", ["status", "--porcelain"], {
        encoding: "utf8",
      }).trim(),
    ),
    node: process.version,
    platform: process.platform,
    artifact: PUBLIC_ARTIFACT,
    input_fingerprint: doc.provenance.input_fingerprint,
    traced_files: trace.files.length,
    traced_bytes: traceBytes,
    samples,
    peak_rss_bytes: process.resourceUsage().maxRSS * 1024,
    limitations: [
      "Local Windows Node/Vite module harness, not a serverless benchmark",
      "Sequential, all-data responses; first iteration cold module data, OS cache uncontrolled",
      "Vite harness contributes memory overhead; process peak includes validation transient allocations",
      "No concurrency or hosted cold-start guarantee",
    ],
  };
  await mkdir("../../output/dashboard", { recursive: true });
  await writeFile(
    "../../output/dashboard/performance.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await server.close();
}
