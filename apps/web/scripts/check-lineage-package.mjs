import { assertPackaging } from "./lineage-package-policy.mjs";
assertPackaging(process.cwd(), process.argv.includes("--output"));
console.log(
  "Lineage approval, public inventory and production-output policy passed.",
);
