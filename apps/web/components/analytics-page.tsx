import {
  dashboard,
  FilterError,
  loadDocument,
  validateFilter,
} from "../lib/data";
import {
  scalarFilters,
  type View,
  type PageSearchParams,
} from "../lib/navigation";
import { projectPageData } from "../lib/page-data";
import { Dashboard } from "./dashboard";
export async function AnalyticsPage({
  view,
  searchParams,
}: {
  view: View;
  searchParams: Promise<PageSearchParams>;
}) {
  let doc;
  try {
    doc = await loadDocument();
  } catch {
    return (
      <section className="standalone">
        <h1>Analytics data unavailable</h1>
        <p role="alert">
          The configured export is missing, invalid, or failed integrity checks.
          No fallback data has been substituted.
        </p>
        <p>
          The dashboard data package must pass integrity checks before reporting
          is available.
        </p>
      </section>
    );
  }
  const input = await searchParams,
    context = {
      provenance: doc.provenance,
      period: doc.data.period,
      options: {
        territories: doc.data.dimensions.territories,
        categories: doc.data.dimensions.categories,
      },
    },
    defaults = validateFilter({}, doc);
  let data = null,
    error;
  try {
    let filters;
    try {
      filters = scalarFilters(input);
    } catch {
      throw new FilterError("Duplicate filter values are not allowed.");
    }
    data = projectPageData(dashboard(doc, filters), view);
  } catch (e) {
    if (!(e instanceof FilterError)) throw e;
    error = e.message;
  }
  return (
    <Dashboard
      key={view + ":" + JSON.stringify(input)}
      view={view}
      data={data}
      context={context}
      defaults={defaults}
      error={error}
    />
  );
}
