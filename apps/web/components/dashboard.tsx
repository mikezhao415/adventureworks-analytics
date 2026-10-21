"use client";
import Link from "next/link";
import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import type { PageData } from "../lib/page-data";
import type { Filter } from "../lib/schema";
import { PAGES, filterHref, type View } from "../lib/navigation";
import { Disclosure, type DataContext } from "./disclosure";
import { Filters, FilterSummary } from "./filters";
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
  data: PageData | null;
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
      <div className="page-heading">
        <div>
          <h1>{page.title}</h1>
          <p className="intro">{page.description}</p>
        </div>
        <Link className="source-link" href={definitionHref} prefetch={false}>
          <BookOpen size={18} aria-hidden="true" />
          Data & Definitions
        </Link>
      </div>
      {view === "filters" ? (
        <Filters
          applied={applied}
          defaults={defaults}
          context={context}
          pending={pending}
          onApply={navigate}
          onReset={() => navigate(null)}
          valid={!error}
        />
      ) : (
        <div className="active-filters">
          <div className="active-filter-details">
            <FilterSummary applied={data ? applied : null} context={context} />
            <span className="filter-explainer">
              Category filters affect Products &amp; Categories only.
            </span>
          </div>
        </div>
      )}
      {pending ? (
        <div className="navigation-loading" role="status">
          Loading the selected view…
        </div>
      ) : error ? (
        <div className="error-banner" role="alert">
          <strong>Filters could not be applied.</strong> {error} Choose valid
          filters or Reset. No metrics are displayed for this URL.
        </div>
      ) : data && view !== "filters" ? (
        <div
          className="dashboard-content"
          data-testid="analytics-content"
          data-filter-key={new URLSearchParams(data.filters).toString()}
        >
          {data.view === "overview" ? (
            <OverviewView data={data} />
          ) : data.view === "trends" ? (
            <TrendsView data={data} />
          ) : data.view === "products" ? (
            <ProductsView data={data} />
          ) : data.view === "customers" ? (
            <CustomersView data={data} />
          ) : data.view === "territories" ? (
            <TerritoriesView data={data} />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
