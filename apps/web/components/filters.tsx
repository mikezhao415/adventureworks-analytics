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
          <div className="date-inputs">
            <label>
              Start date
              <input
                type="date"
                required
                value={draft.start}
                onChange={(e) => setDraft({ ...draft, start: e.target.value })}
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
