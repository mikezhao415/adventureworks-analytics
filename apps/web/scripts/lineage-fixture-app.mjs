// Isolated fictional production packaging check. Never stages real metadata.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const source = process.cwd();
const output = path.resolve(source, "../../output/custom-lineage-review");
const destination = path.resolve(
  process.argv.includes("--reuse")
    ? JSON.parse(
        readFileSync(path.join(output, "fixture-app-current.json"), "utf8"),
      ).path
    : path.join(output, "fixture-app-" + Date.now()),
);
if (
  !destination.startsWith(output + path.sep) ||
  !existsSync(path.join(source, "tests/fixtures/lineage.json"))
)
  throw new Error("Run from apps/web");
mkdirSync(output, { recursive: true });
if (
  process.argv.includes("--reuse") &&
  !readFileSync(path.join(source, "package-lock.json")).equals(
    readFileSync(path.join(destination, "package-lock.json")),
  )
)
  throw new Error(
    "Dependency lock changed; create a new disposable copy instead of reusing it",
  );
cpSync(source, destination, {
  recursive: true,
  filter: (p) =>
    !p
      .slice(source.length)
      .split(path.sep)
      .some((s) =>
        [
          "node_modules",
          ".next",
          "test-results",
          "playwright-report",
          ".git",
        ].includes(s),
      ),
});
// Turbopack's hermetic root excludes an external node_modules junction.
// Copy the installed, locked dependencies; do not change workspace configuration.
if (!existsSync(path.join(destination, "node_modules")))
  cpSync(
    path.join(source, "node_modules"),
    path.join(destination, "node_modules"),
    { recursive: true },
  );
const raw = readFileSync(path.join(source, "tests/fixtures/lineage.json"));
// Keep the historical negative canary outside the positive packaging copy.
// A fresh NFT can legitimately over-trace data/; the new guard rejects that.
const oldCanary = path.join(destination, "data/private-manifest.json");
if (existsSync(oldCanary)) {
  if (
    readFileSync(oldCanary, "utf8") !==
    '{"macros":{"sql":"PRIVATE_LINEAGE_SQL_CANARY"}}\n'
  )
    throw new Error("Unexpected fixture canary bytes");
  renameSync(
    oldCanary,
    path.join(output, "preserved-negative-canary-" + Date.now() + ".json"),
  );
}
const doc = JSON.parse(raw);
writeFileSync(path.join(destination, "data/lineage/sales.json"), raw);
writeFileSync(
  path.join(destination, "data/lineage/approval.json"),
  JSON.stringify(
    {
      schema_version: 1,
      publication_approved: true,
      sha256: createHash("sha256").update(raw).digest("hex"),
      content_sha256: doc.content_sha256,
      review_reference: "FICTIONAL ISOLATED PACKAGING TEST ONLY",
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  path.join(output, "fixture-app-current.json"),
  JSON.stringify({ path: destination, scope: "fictional test artifact only" }) +
    "\n",
);
console.log(destination);
if (!process.argv.includes("--prepare-only")) {
  execFileSync(
    process.execPath,
    [path.join(destination, "scripts/check-lineage-package.mjs")],
    { cwd: destination, stdio: "inherit" },
  );
  execFileSync(
    process.execPath,
    [path.join(destination, "node_modules/next/dist/bin/next"), "build"],
    {
      cwd: destination,
      stdio: "inherit",
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    },
  );
  execFileSync(
    process.execPath,
    [path.join(destination, "scripts/check-lineage-package.mjs"), "--output"],
    { cwd: destination, stdio: "inherit" },
  );
}
