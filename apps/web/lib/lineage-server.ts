import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateApprovedLineage } from "./lineage-validation.mjs";
export { canonical, validateApprovedLineage } from "./lineage-validation.mjs";

export async function loadLineage() {
  const folder = path.join(process.cwd(), "data", "lineage");
  // Read approval first: a missing/unapproved artifact never reaches the client.
  const approval = JSON.parse(
    await readFile(path.join(folder, "approval.json"), "utf8"),
  );
  if (approval.publication_approved !== true)
    throw new Error("Lineage has not been approved");
  return validateApprovedLineage(
    await readFile(path.join(folder, "sales.json")),
    approval,
  );
}
