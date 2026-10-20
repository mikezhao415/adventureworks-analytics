import { BarChart3 } from "lucide-react";
export function Panel({
  id,
  kicker,
  title,
  subtitle,
  children,
  action,
}: {
  id: string;
  kicker: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="panel" aria-labelledby={`${id}-title`}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{kicker}</p>
          <h2 id={`${id}-title`}>{title}</h2>
          {subtitle ? <p className="muted panel-subtitle">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Empty({
  text = "No shipped sales match this selection.",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <BarChart3 size={25} aria-hidden="true" />
      <p>{text}</p>
      <span>Try a wider date range or reset the filters.</span>
    </div>
  );
}
export function ExactTable({
  children,
  caption,
}: {
  children: React.ReactNode;
  caption: string;
}) {
  return (
    <details className="exact">
      <summary>View exact data</summary>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label={caption}
      >
        <table>
          <caption className="sr-only">{caption}</caption>
          {children}
        </table>
      </div>
    </details>
  );
}
