// Authoritative Node validator shared by the runtime loader and packaging preflight.
import { createHash } from "node:crypto";
import { z } from "zod";
import { lineageSchema } from "./lineage-schema.mjs";

export function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => canonical(k) + ":" + canonical(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value).replace(
    /[\u007f-\uffff]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}
const digest = (raw) => createHash("sha256").update(raw).digest("hex");
const approvedRecord = z.strictObject({
  schema_version: z.literal(1),
  publication_approved: z.literal(true),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  content_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  review_reference: z.string().trim().min(1),
});
const pendingRecord = z.strictObject({
  schema_version: z.literal(1),
  publication_approved: z.literal(false),
  sha256: z.null(),
  content_sha256: z.null(),
  review_reference: z.null(),
});
export const approvalRecordSchema = z.union([approvedRecord, pendingRecord]);
export function validateLineagePackage(raw, approval) {
  const pin = approvalRecordSchema.parse(approval);
  if (raw === null) {
    if (pin.publication_approved)
      throw new Error("Approved lineage artifact is missing");
    return null;
  }
  return validateApprovedLineage(raw, pin);
}
export function validateApprovedLineage(raw, approval) {
  const pin = approvedRecord.parse(approval);
  if (raw.length > 1_000_000 || digest(raw) !== pin.sha256)
    throw new Error("Unapproved lineage bytes");
  const doc = lineageSchema.parse(JSON.parse(raw.toString("utf8")));
  if (raw.toString("utf8") !== canonical(doc) + "\n")
    throw new Error("Noncanonical lineage bytes");
  const { content_sha256, ...content } = doc;
  const { generated_at: omitted, ...provenance } = content.provenance;
  void omitted;
  if (
    digest(canonical({ ...content, provenance })) !== content_sha256 ||
    content_sha256 !== pin.content_sha256
  )
    throw new Error("Lineage content mismatch");
  return doc;
}
