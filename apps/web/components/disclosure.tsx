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
            : "Historical AdventureWorks snapshot"}
        </strong>
        <span>
          {demo
            ? "Deterministic fixtures — not actual AdventureWorks results."
            : "Validated local data — not a live sales feed."}{" "}
          Source period {context.period.start || "empty"} to{" "}
          {context.period.end || "empty"}. Amounts use source monetary units;
          currency is unverified.
        </span>
      </p>
      <span className="context-tag">
        {demo ? "DEMO MODE" : "LOCAL SNAPSHOT"}
      </span>
    </div>
  );
}
