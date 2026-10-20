import { ShieldCheck } from "lucide-react";
import type { DashboardData } from "../lib/data";
export type DataContext = Pick<
  DashboardData,
  "provenance" | "period" | "options"
>;
export function Disclosure({ context }: { context: DataContext }) {
  const demo = context.provenance.mode === "offline_fixture";
  return (
    <div className="context-banner">
      <span className="context-icon">
        <ShieldCheck size={23} aria-hidden="true" />
      </span>
      <p>
        <strong>
          {demo
            ? "Fictional demonstration data"
            : "AdventureWorks 2022 Sample Data"}
        </strong>
        <span>
          {demo
            ? "Deterministic fixtures — not actual AdventureWorks results."
            : "Microsoft fictional historical sample business — not a live sales feed."}{" "}
          Source period {context.period.start || "empty"} to{" "}
          {context.period.end || "empty"}. Amounts shown in USD; no currency
          conversion applied.
        </span>
      </p>
      <span className="context-tag">
        {demo ? "DEMO MODE" : "HISTORICAL SAMPLE"}
      </span>
    </div>
  );
}
