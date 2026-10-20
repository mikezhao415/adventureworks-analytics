"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { preserveQuery } from "../lib/navigation";
import { useId, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const query = useSearchParams().toString();
  return (
    <article
      className={`kpi ${accent ? "kpi-accent" : ""}`}
      aria-label={label}
      aria-describedby={id}
    >
      <div className="kpi-label">
        <span>{label}</span>
        <div
          className="metric-help"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={(e) => {
            if (!e.currentTarget.contains(document.activeElement))
              setOpen(false);
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <button
            type="button"
            className="info"
            aria-label={`About ${label}`}
            aria-expanded={open}
            aria-controls={id + "-help"}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
          >
            i
          </button>
          {open ? (
            <div id={id + "-help"} className="metric-popover">
              <p>{description}</p>
              <Link href={preserveQuery("/definitions", query)}>
                Data &amp; Definitions
              </Link>
              <button type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <p className="kpi-value" data-testid={accent ? "sales-kpi" : undefined}>
        {value}
      </p>
      <span id={id} className="sr-only">
        {description}
      </span>
      <p className="kpi-detail">{detail}</p>
    </article>
  );
}
