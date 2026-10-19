import { useId } from "react";
import { ArrowUpRight } from "lucide-react";
export function Kpi({
  label,
  value,
  detail,
  description,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  description: string;
  accent?: boolean;
}) {
  const id = useId();
  return (
    <article
      className={`kpi ${accent ? "kpi-accent" : ""}`}
      aria-label={label}
      aria-describedby={id}
    >
      <div className="kpi-label">
        <span>{label}</span>
        <span title={description} className="info" aria-label={description}>
          i
        </span>
      </div>
      <p className="kpi-value" data-testid={accent ? "sales-kpi" : undefined}>
        {value}
      </p>
      <span id={id} className="sr-only">
        {description}
      </span>
      <p className="kpi-detail">{detail}</p>
      {accent ? (
        <ArrowUpRight className="kpi-arrow" size={20} aria-hidden="true" />
      ) : null}
    </article>
  );
}
