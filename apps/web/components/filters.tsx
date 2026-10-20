"use client";
import { useEffect, useState, type FormEvent } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import type { Filter } from "../lib/schema";
import type { DataContext } from "./disclosure";
export function Filters({
  applied,
  defaults,
  context,
  pending,
  onApply,
  onReset,
}: {
  applied: Filter;
  defaults: Filter;
  context: DataContext;
  pending: boolean;
  onApply: (value: Filter) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(applied),
    [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  function submit(e: FormEvent) {
    e.preventDefault();
    onApply(draft);
  }
  return (
    <form
      className="filterbar"
      aria-label="Analytics filters"
      onSubmit={submit}
    >
      <span className="filter-icon">
        <SlidersHorizontal size={20} aria-hidden="true" />
        Filters
      </span>
      <label>
        From
        <input
          disabled={!ready || pending}
          type="date"
          aria-label="Start date"
          value={draft.start}
          onChange={(e) => setDraft({ ...draft, start: e.target.value })}
          required
        />
      </label>
      <label>
        To
        <input
          disabled={!ready || pending}
          type="date"
          aria-label="End date"
          value={draft.end}
          onChange={(e) => setDraft({ ...draft, end: e.target.value })}
          required
        />
      </label>
      <label>
        Territory
        <select
          disabled={!ready || pending}
          aria-label="Territory"
          value={draft.territory}
          onChange={(e) => setDraft({ ...draft, territory: e.target.value })}
        >
          <option value="all">All territories</option>
          {context.options.territories.map((t) => (
            <option key={t.key} value={t.key}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Category · products page only
        <select
          disabled={!ready || pending}
          aria-label="Product category"
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
        >
          <option value="all">All categories</option>
          {context.options.categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="button-primary"
        type="submit"
        disabled={!ready || pending}
      >
        {pending ? "Applying…" : "Apply filters"}
      </button>
      <button
        className="button-reset"
        type="button"
        disabled={!ready || pending}
        aria-label="Reset filters"
        onClick={() => {
          setDraft(defaults);
          onReset();
        }}
      >
        <RotateCcw size={18} aria-hidden="true" />
        Reset
      </button>
    </form>
  );
}
