"use client";
import Link from "next/link";
import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Database, ArrowUpRight } from "lucide-react";
import type { DashboardData } from "../lib/data";
import type { Filter } from "../lib/schema";
import { PAGES, filterHref, type View } from "../lib/navigation";
import { Disclosure, type DataContext } from "./disclosure";
import { Filters } from "./filters";
import {
  OverviewView,
  ProductsView,
  TerritoriesView,
  TrendsView,
} from "./views";
import { CustomersView } from "./customers";
export function Dashboard({
  data,
  context,
  defaults,
  view,
  error,
}: {
  data: DashboardData | null;
  context: DataContext;
  defaults: Filter;
  view: View;
  error?: string;
}) {
  const pathname = usePathname(),
    router = useRouter(),
    [pending, startTransition] = useTransition();
  const page = PAGES.find((p) => p.path === pathname) || PAGES[0],
    applied = data?.filters || defaults;
  const category = context.options.categories.find(
    (c) => String(c.key) === applied.category,
  )?.name;
  const definitionHref = data
    ? filterHref("/definitions", data.filters)
    : "/definitions";
  function navigate(value: Filter | null) {
    startTransition(() =>
      router.push(value ? filterHref(pathname, value) : pathname, {
        scroll: false,
      }),
    );
  }
  return (
    <>
      <Disclosure context={context} />
      <Filters
        applied={applied}
        defaults={defaults}
        context={context}
        pending={pending}
        onApply={navigate}
        onReset={() => navigate(null)}
      />
      <div className="active-filters" aria-live="polite">
        {data ? (
          <>
            <span className="status-dot" />
            <strong>
              {applied.start} — {applied.end}
            </strong>
            <span>
              ·{" "}
              {applied.territory === "all"
                ? "All territories"
                : context.options.territories.find(
                    (t) => String(t.key) === applied.territory,
                  )?.name}
            </span>
            {category ? (
              <span className="filter-chip">
                {category} · products & categories only
              </span>
            ) : null}
          </>
        ) : (
          <strong>Invalid selection — no analytics displayed</strong>
        )}
        <span className="filter-explainer">
          Category applies only on the products & categories page.
        </span>
      </div>
      <div className="page-heading">
        <div>
          <h1>{page.title}</h1>
          <p className="intro">{page.description}</p>
        </div>
        <Link className="source-link" href={definitionHref} prefetch={false}>
          <Database size={18} aria-hidden="true" />
          Data & definitions
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      {pending ? (
        <div className="navigation-loading" role="status">
          Loading the selected view…
        </div>
      ) : error ? (
        <div className="error-banner" role="alert">
          <strong>Filters could not be applied.</strong> {error} Choose valid
          filters or Reset. No metrics are displayed for this URL.
        </div>
      ) : data ? (
        <div
          className="dashboard-content"
          data-testid="analytics-content"
          data-filter-key={new URLSearchParams(data.filters).toString()}
        >
          {view === "overview" ? (
            <OverviewView data={data} />
          ) : view === "trends" ? (
            <TrendsView data={data} />
          ) : view === "products" ? (
            <ProductsView data={data} />
          ) : view === "customers" ? (
            <CustomersView data={data} />
          ) : (
            <TerritoriesView data={data} />
          )}
        </div>
      ) : null}
    </>
  );
}
