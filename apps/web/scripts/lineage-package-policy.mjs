import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { validateLineagePackage } from "../lib/lineage-validation.mjs";

// Build-only parser already supplied by pinned Next.js. No runtime dependency.
const { parse } = createRequire(import.meta.url)(
  "next/dist/compiled/babel/parser",
);
const relativeAsset = z
  .string()
  .regex(/^(?!\/)(?!.*(?:^|\/)\.\.?($|\/))[A-Za-z0-9_./-]+$/);
const inventorySchema = z.strictObject({
  schema_version: z.literal(1),
  files: z.record(
    relativeAsset,
    z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
  ),
  emitted_media: z.record(z.string().regex(/^[a-f0-9]{64}$/), relativeAsset),
});
const inventory = inventorySchema.parse(
  JSON.parse(
    readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "public-assets.json",
      ),
      "utf8",
    ),
  ),
);
const sha = (raw) => createHash("sha256").update(raw).digest("hex");
const normalize = (p) => p.split(path.sep).join("/");
export function files(folder) {
  if (!existsSync(folder)) return [];
  if (lstatSync(folder).isSymbolicLink())
    throw new Error("Symlink in publication input: " + folder);
  return readdirSync(folder).flatMap((name) => {
    const p = path.join(folder, name),
      stat = lstatSync(p);
    if (stat.isSymbolicLink())
      throw new Error("Symlink in publication input: " + p);
    return stat.isDirectory() ? files(p) : [p];
  });
}

export function assertPublicAssets(root) {
  const folder = path.join(root, "public"),
    actual = files(folder)
      .map((p) => normalize(path.relative(folder, p)))
      .sort();
  if (
    inventory.schema_version !== 1 ||
    JSON.stringify(actual) !==
      JSON.stringify(Object.keys(inventory.files).sort())
  )
    throw new Error("Public asset inventory mismatch");
  for (const name of actual)
    if (
      !inventory.files[name].includes(
        sha(readFileSync(path.join(folder, name))),
      )
    )
      throw new Error("Changed reviewed public asset: " + name);
}

export function validatePackagingInputs(root) {
  assertPublicAssets(root);
  const folder = path.join(root, "data/lineage");
  for (const p of files(folder))
    if (!["approval.json", "sales.json"].includes(path.relative(folder, p)))
      throw new Error("Unexpected lineage data file: " + p);
  const approval = JSON.parse(
    readFileSync(path.join(folder, "approval.json"), "utf8"),
  );
  const artifact = path.join(folder, "sales.json");
  return validateLineagePackage(
    existsSync(artifact) ? readFileSync(artifact) : null,
    approval,
  );
}

function forbiddenShape(keys, literalNodes = true) {
  const has = (k) => keys.includes(k);
  return (
    ["raw_code", "compiled_code", "raw_sql", "compiled_sql", "macro_sql"].some(
      has,
    ) ||
    (has("nodes") && has("sources") && (has("macros") || has("metadata"))) ||
    (literalNodes &&
      has("nodes") &&
      has("edges") &&
      (has("provenance") || has("content_sha256"))) ||
    (has("kind") && has("columns") && (has("materialization") || has("tests")))
  );
}
function inspectValue(value, label) {
  if (typeof value === "string") {
    inspectString(value, label);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (!Array.isArray(value) && forbiddenShape(Object.keys(value)))
    throw new Error("Embedded unpublished metadata: " + label);
  for (const child of Object.values(value)) inspectValue(child, label);
}
function inspectString(value, label) {
  if (typeof value !== "string") return;
  try {
    const decoded = JSON.parse(value);
    inspectValue(decoded, label);
  } catch (e) {
    if (e.message.startsWith("Embedded unpublished")) throw e;
  }
}

/** Parse objects and decoded string literals, independent of minified names. */
export function inspectJavaScript(source, label) {
  const ast = parse(source, { sourceType: "unambiguous" });
  const pending = [ast];
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== "object") continue;
    if (node.type === "ObjectExpression") {
      const properties = node.properties.filter(
        (p) => p.type === "ObjectProperty",
      );
      const key = (p) => p.key?.name ?? p.key?.value;
      const keys = properties.map(key);
      const nodes = properties.find((p) => key(p) === "nodes");
      const literalNodes =
        Boolean(nodes) && nodes.value?.type !== "CallExpression";
      // Schema construction calls are not serialized metadata payloads.
      const columns = properties.find((p) => key(p) === "columns");
      const literalColumns =
        Boolean(columns) && columns.value?.type !== "CallExpression";
      if (
        forbiddenShape(
          keys.filter((k) => k !== "columns" || literalColumns),
          literalNodes,
        )
      )
        throw new Error("Embedded unpublished metadata: " + label);
    }
    if (node.type === "StringLiteral") inspectString(node.value, label);
    if (node.type === "TemplateLiteral" && node.expressions.length === 0)
      inspectString(node.quasis.map((q) => q.value.cooked).join(""), label);
    for (const [key, value] of Object.entries(node))
      if (
        !["loc", "start", "end", "extra", "comments", "tokens"].includes(key)
      ) {
        if (Array.isArray(value)) pending.push(...value);
        else if (value && typeof value === "object") pending.push(value);
      }
  }
}

function inspectEmbeddedJson(text, label) {
  // JSON in CSS/HTML comments or data URLs also cannot bypass the JS AST check.
  const starts = /[\[{]\s*"/g;
  let match;
  while ((match = starts.exec(text))) {
    let quote = false,
      escaped = false,
      depth = 0;
    for (let i = match.index; i < text.length; i++) {
      const c = text[i];
      if (quote) {
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') quote = false;
        continue;
      }
      if (c === '"') quote = true;
      else if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") {
        if (--depth === 0) {
          inspectString(text.slice(match.index, i + 1), label);
          break;
        }
      }
    }
  }
  for (const match of text.matchAll(
    /data:application\/json(;base64)?,([^\s"'<>)]*)/g,
  )) {
    inspectString(
      match[1]
        ? Buffer.from(match[2], "base64").toString("utf8")
        : decodeURIComponent(match[2]),
      label,
    );
  }
}

export function inspectOutputFile(file) {
  const text = readFileSync(file, "utf8");
  // Supplemental native/canary checks, not the primary publication boundary.
  if (
    /MANIFEST\.JSON INLINE DATA|NEVER_PUBLISH_TEST_SQL|PRIVATE_LINEAGE_SQL_CANARY|ng-app=["']dbt/.test(
      text,
    )
  )
    throw new Error("Forbidden output content: " + file);
  if (file.endsWith(".js")) inspectJavaScript(text, file);
  else if (file.endsWith(".json")) inspectString(text, file);
  else if (file.endsWith(".html"))
    for (const script of text.matchAll(
      /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    )) {
      if (/application\/(?:ld\+)?json/i.test(script[1]))
        inspectString(script[2], file);
      else if (script[2].trim()) inspectJavaScript(script[2], file);
    }
  inspectEmbeddedJson(text, file);
}

export function assertClientAssets(root) {
  const folder = path.join(root, ".next/static");
  if (!existsSync(folder)) throw new Error("Missing emitted client assets");
  for (const file of files(folder)) {
    // The existing favicon is permitted by exact bytes, not by its generated name.
    if (
      path.extname(file) === ".svg" &&
      Object.hasOwn(inventory.emitted_media, sha(readFileSync(file)))
    )
      continue;
    // New media, fonts, maps or data need explicit review.
    if (![".js", ".css"].includes(path.extname(file)))
      throw new Error("Unexpected emitted client asset: " + file);
    inspectOutputFile(file);
  }
}

function assertSourceImports(root) {
  for (const folder of ["app", "components", "lib"])
    for (const file of files(path.join(root, folder))) {
      if (!/\.(tsx?|m?js)$/.test(file)) continue;
      const ast = parse(readFileSync(file, "utf8"), {
        sourceType: "module",
        plugins: ["typescript", "jsx"],
      });
      const pending = [ast];
      while (pending.length) {
        const node = pending.pop();
        if (!node || typeof node !== "object") continue;
        const specifier =
          node.type === "ImportDeclaration" ||
          String(node.type).startsWith("Export")
            ? node.source?.value
            : node.type === "CallExpression" &&
                (node.callee?.name === "require" ||
                  node.callee?.type === "Import")
              ? node.arguments[0]?.value
              : node.type === "ImportExpression"
                ? node.source?.value
                : null;
        if (
          typeof specifier === "string" &&
          (specifier.endsWith(".json") ||
            /(?:^|\/)(?:output|docs|tests)\//.test(specifier))
        ) {
          const allowed =
            path.resolve(path.dirname(file), specifier) ===
            path.join(root, "lib/lineage-reference.json");
          if (!allowed)
            throw new Error(
              "Unreviewed application metadata import: " + specifier,
            );
        }
        for (const [key, value] of Object.entries(node))
          if (!["loc", "extra", "comments"].includes(key)) {
            if (Array.isArray(value)) pending.push(...value);
            else if (value && typeof value === "object") pending.push(value);
          }
      }
    }
}

export function assertPackaging(root, output = false) {
  root = path.resolve(root);
  validatePackagingInputs(root); // Must precede compilation/tracing and run again after.
  assertSourceImports(root);
  if (!output) return;
  assertClientAssets(root);
  let traces = 0;
  for (const file of files(path.join(root, ".next/server"))) {
    if (file.endsWith(".nft.json")) {
      traces++;
      for (const entry of JSON.parse(readFileSync(file, "utf8")).files) {
        const resolved = path.resolve(path.dirname(file), entry),
          relative = normalize(path.relative(root, resolved));
        if (
          /(?:^|\/)(?:output|tests|docs)\//.test(relative) ||
          /\/(?:manifest(?:\.sanitized)?|catalog(?:\.sanitized)?|run_results)\.json$/.test(
            normalize(resolved),
          ) ||
          relative.startsWith("public/dbt/")
        )
          throw new Error("Forbidden traced file: " + relative);
        if (
          relative.startsWith("data/") &&
          ![
            "data/adventureworks2022.json",
            "data/lineage/approval.json",
            "data/lineage/sales.json",
          ].includes(relative)
        )
          throw new Error("Unexpected traced data: " + relative);
      }
    }
    inspectOutputFile(file);
  }
  if (!traces) throw new Error("No production traces to inspect");
  const tracePath = path.join(
    root,
    ".next/server/app/lineage/page.js.nft.json",
  );
  const traced = JSON.parse(readFileSync(tracePath, "utf8")).files.map((f) =>
    path.resolve(path.dirname(tracePath), f),
  );
  for (const name of ["approval.json", "sales.json"]) {
    const p = path.join(root, "data/lineage", name);
    if (existsSync(p) && !traced.includes(p))
      throw new Error("Lineage runtime input not packaged: " + name);
  }
}
