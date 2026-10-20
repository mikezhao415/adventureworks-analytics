import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
const [unit, browser, demo, pkg, lock] = await Promise.all([
  readJson("test-results/vitest.json"),
  readJson("test-results/playwright.json"),
  readJson("data/demo.json"),
  readJson("package.json"),
  readFile("package-lock.json"),
]);
const completed = unit !== null && browser !== null;
const pass =
  completed &&
  unit.success === true &&
  browser.stats.unexpected === 0 &&
  browser.stats.skipped === 0;
const evidence = {
  mode: "offline_fixture",
  result: !completed ? "incomplete" : pass ? "pass" : "fail",
  execution_context:
    process.env.GITHUB_ACTIONS === "true" ? "github_actions" : "local",
  code_revision: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  working_tree_dirty: Boolean(
    execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  ),
  environment: {
    node: process.version,
    platform: process.platform,
    dependencies: pkg.dependencies,
    devDependencies: pkg.devDependencies,
  },
  package_lock_sha256: createHash("sha256").update(lock).digest("hex"),
  input_fingerprint: demo.provenance.input_fingerprint,
  content_sha256: demo.content_sha256,
  vitest: unit
    ? {
        tests: unit.numTotalTests,
        failed: unit.numFailedTests,
        success: unit.success,
      }
    : null,
  playwright: browser?.stats ?? null,
  limitations: [
    "Deterministic fictional fixtures; real-source HTTP validation is local and separate.",
    "Chromium desktop and mobile emulation, not every browser or physical device.",
    "Automated accessibility checks do not establish complete accessibility compliance.",
  ],
};
await mkdir("test-results", { recursive: true });
await writeFile(
  "test-results/evidence.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(`Dashboard evidence: ${evidence.result}`);
