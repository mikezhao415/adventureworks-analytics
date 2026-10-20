"use client";
import { useState, useEffect, type FormEvent } from "react";
import type { Filter } from "../lib/schema";
import { isoDate } from "../lib/schema";
import type { DataContext } from "./disclosure";
export function FilterSummary({
  applied,
  context,
}: {
  applied: Filter | null;
  context: DataContext;
}) {
  return (
    <div className="filter-summary" aria-label="Applied Filters">
      {applied ? (
        <>
          <span className="filter-chip">
            {applied.start} - {applied.end}
          </span>
          {(["territory", "category"] as const).map((key) => (
            <span className="filter-chip" key={key}>
              {applied[key] === "all"
                ? key === "territory"
                  ? "All Territories"
                  : "All Categories"
                : context.options[
                    key === "territory" ? "territories" : "categories"
                  ]
                    .filter((o) =>
                      applied[key].split(",").includes(String(o.key)),
                    )
                    .map((o) => o.name)
                    .join(", ")}
            </span>
          ))}
        </>
      ) : (
        <strong>Invalid selection - no analytics displayed</strong>
      )}
    </div>
  );
}
export function Filters({
  applied,
  defaults,
  context,
  pending,
  onApply,
  onReset,
  valid = true,
}: {
  applied: Filter;
  defaults: Filter;
  context: DataContext;
  pending: boolean;
  onApply: (value: Filter) => void;
  onReset: () => void;
  valid?: boolean;
}) {
  const [draft, setDraft] = useState(applied),
    [preset, setPreset] = useState(
      applied.start === defaults.start && applied.end === defaults.end
        ? "Full History"
        : "Custom Range",
    ),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (
      !isoDate.safeParse(draft.start).success ||
      !isoDate.safeParse(draft.end).success ||
      draft.start > draft.end
    ) {
      setError(
        "Choose a valid date range with the start on or before the end.",
      );
      return;
    }
    setError("");
    onApply(draft);
  }
  function changePeriod(kind: string, value: string) {
    setPreset(kind);
    if (kind === "Full History") {
      setDraft({ ...draft, start: defaults.start, end: defaults.end });
      return;
    }
    if (kind === "Custom Range") return;
    const [year, part] = value.split("-");
    const month =
      kind === "Year"
        ? 1
        : kind === "Quarter"
          ? (Number(part) - 1) * 3 + 1
          : Number(part);
    const endMonth =
      kind === "Year" ? 12 : kind === "Quarter" ? month + 2 : month;
    setDraft({
      ...draft,
      start: `${year}-${String(month).padStart(2, "0")}-01`,
      end: new Date(Date.UTC(Number(year), endMonth, 0))
        .toISOString()
        .slice(0, 10),
    });
  }
  const years = Array.from(
    {
      length:
        Number(defaults.end.slice(0, 4)) -
        Number(defaults.start.slice(0, 4)) +
        1,
    },
    (_, i) => String(Number(defaults.start.slice(0, 4)) + i),
  );
  const periods =
    preset === "Year"
      ? years
      : years.flatMap((y) =>
          Array.from(
            { length: preset === "Quarter" ? 4 : 12 },
            (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`,
          ),
        );
  return (
    <form
      className="filters-layout"
      aria-label="Analytics Filters"
      onSubmit={submit}
    >
      <section className="definitions-card configure-filters">
        <h2>Configure Filters</h2>
        <fieldset disabled={!ready || pending}>
          <legend>Date Range</legend>
          <label>
            Date preset
            <select
              value={preset}
              onChange={(e) =>
                changePeriod(e.target.value, defaults.start.slice(0, 4) + "-01")
              }
            >
              {["Full History", "Year", "Quarter", "Month", "Custom Range"].map(
                (p) => (
                  <option key={p}>{p}</option>
                ),
              )}
            </select>
          </label>
          {["Year", "Quarter", "Month"].includes(preset) ? (
            <label>
              {preset}
              <select
                aria-label={preset}
                value={
                  preset === "Year"
                    ? draft.start.slice(0, 4)
                    : preset === "Quarter"
                      ? `${draft.start.slice(0, 4)}-${String(Math.ceil(Number(draft.start.slice(5, 7)) / 3)).padStart(2, "0")}`
                      : draft.start.slice(0, 7)
                }
                onChange={(e) => changePeriod(preset, e.target.value)}
              >
                {periods.map((p) => (
                  <option key={p} value={p}>
                    {preset === "Quarter" ? p.replace("-0", " Q") : p}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {preset === "Custom Range" ? (
            <div className="date-inputs">
              <label>
                Start date
                <input
                  type="date"
                  required
                  value={draft.start}
                  onChange={(e) =>
                    setDraft({ ...draft, start: e.target.value })
                  }
                />
              </label>
              <label>
                End date
                <input
                  type="date"
                  required
                  value={draft.end}
                  onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                />
              </label>
            </div>
          ) : null}
        </fieldset>
        {(["territory", "category"] as const).map((key) => {
          const options =
            context.options[key === "territory" ? "territories" : "categories"];
          return (
            <fieldset disabled={!ready || pending} key={key}>
              <legend>
                {key === "territory" ? "Territories" : "Product Categories"}
              </legend>
              <label className="check-option">
                <input
                  type="checkbox"
                  checked={draft[key] === "all"}
                  onChange={() => setDraft({ ...draft, [key]: "all" })}
                />
                All {key === "territory" ? "Territories" : "Categories"}
              </label>
              {options.map((o) => (
                <label className="check-option" key={o.key}>
                  <input
                    type="checkbox"
                    checked={
                      draft[key] !== "all" &&
                      draft[key].split(",").includes(String(o.key))
                    }
                    onChange={() => {
                      const selected =
                        draft[key] === "all" ? [] : draft[key].split(",");
                      const next = selected.includes(String(o.key))
                        ? selected.filter((k) => k !== String(o.key))
                        : [...selected, String(o.key)];
                      setDraft({
                        ...draft,
                        [key]: next.length
                          ? next.sort((a, b) => Number(a) - Number(b)).join(",")
                          : "all",
                      });
                    }}
                  />
                  {o.name}
                </label>
              ))}
            </fieldset>
          );
        })}
      </section>
      <section className="definitions-card applied-filters">
        <h2>Applied Filters</h2>
        <FilterSummary applied={valid ? applied : null} context={context} />
        <p>Category filters affect Products &amp; Categories only.</p>
        <p
          role="status"
          className={dirty ? "draft-status draft-dirty" : "draft-status"}
        >
          {dirty ? "Unsaved Changes" : "No Pending Changes"}
        </p>
        <p>
          Changes stay in Configure Filters until you apply them. Leaving this
          page discards unapplied changes.
        </p>
        {error ? <p role="alert">{error}</p> : null}
        <div className="filter-actions">
          <button
            className="button-primary"
            disabled={!ready || pending}
            type="submit"
          >
            {pending ? "Applying-" : "Apply Filters"}
          </button>
          <button
            className="button-reset"
            disabled={!ready || pending}
            type="button"
            onClick={() => {
              setDraft(defaults);
              setPreset("Full History");
              setError("");
              onReset();
            }}
          >
            Reset Filters
          </button>
        </div>
      </section>
    </form>
  );
}
