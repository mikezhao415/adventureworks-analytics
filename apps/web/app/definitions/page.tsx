import { loadDocument } from "../../lib/data";
import { METRICS } from "../../lib/format";
import { Disclosure } from "../../components/disclosure";
export const dynamic = "force-dynamic";
export default async function Definitions() {
  let doc;
  try {
    doc = await loadDocument();
  } catch {
    return (
      <section>
        <h1>Metric definitions</h1>
        <p role="alert">
          Data provenance is unavailable because the configured export failed to
          load. No fallback data has been substituted.
        </p>
      </section>
    );
  }
  const context = {
    provenance: doc.provenance,
    period: doc.data.period,
    options: {
      territories: doc.data.dimensions.territories,
      categories: doc.data.dimensions.categories,
    },
  };
  return (
    <>
      <Disclosure context={context} />
      <div className="page-heading">
        <div>
          <h1>Metric definitions</h1>
          <p className="intro">
            Calculation rules, filter scopes and the provenance behind every
            view.
          </p>
        </div>
      </div>
      <section className="definitions-card" aria-labelledby="metrics-heading">
        <h2 id="metrics-heading">Metrics and calculation rules</h2>
        <dl>
          {Object.values(METRICS).map((m) => (
            <div key={m.label}>
              <dt>{m.label}</dt>
              <dd>{m.description}</dd>
            </div>
          ))}
          <div>
            <dt>Header subtotal and net line sales</dt>
            <dd>
              Header subtotal preserves four decimals at one row per order. Net
              line sales preserve six decimals at one row per order line. Lines
              are summed and rounded once per order to reconcile its header
              subtotal. Global header and line sums may therefore differ. Tax
              and freight are separate; header money is never allocated to
              product lines.
            </dd>
          </div>
          <div>
            <dt>Average order value</dt>
            <dd>
              Sum the selected orders’ header subtotals, divide by the selected
              shipped-order count and round half away from zero to four
              decimals. Empty selections have NULL AOV. Existing cell-level AOV
              values are never averaged.
            </dd>
          </div>
          <div>
            <dt>Aggregation grain</dt>
            <dd>
              Customer cells: calendar day × order territory × customer. Product
              cells: day × order territory × product. Category cells: day ×
              order territory × category. Dates and territories form disjoint
              cells. Product/category counts use distinct order IDs within each
              group, overlap between groups and must not be added to overview
              counts.
            </dd>
          </div>
          <div>
            <dt>Display amounts and currency</dt>
            <dd>
              USD — native AdventureWorks sample amounts; no currency conversion
              applied. Headline sales and AOV use en-US USD currency formatting
              with zero fraction digits, rounding only after exact aggregation.
              Detailed data retains the original decimal strings. This
              interpretation is supported by SQL Server currency-rate
              relationships (all referenced rates originate in USD) and matching
              native prices across rate groups, including orders without a rate.
              Microsoft's OLTP schema does not explicitly label every monetary
              column as USD or define NULL rate IDs as USD. The reviewed
              interpretation applies to this inspected sample; fictional demo
              amounts use the same presentation convention.
            </dd>
          </div>
          <div>
            <dt>Customer comparisons</dt>
            <dd>
              Each metric has an independent minimum/maximum scale across the
              full customer dataset selected by date and territory, before
              search or pagination. These bars are relative comparisons, not
              proportions of a total. Identical positive values use full bars;
              zero values use empty bars; unavailable AOV is shown as an em
              dash. Contribution percentages retain their actual percentage
              values alongside the relative bars.
            </dd>
          </div>
        </dl>
      </section>
      <section className="definitions-card" aria-labelledby="scope-heading">
        <h2 id="scope-heading">Filter scope and calendar</h2>
        <p>
          Inclusive calendar-day date range and order territory apply to every
          analytics page. Product category affects only product/category views;
          overview, trends, customers and territory measures remain
          all-category. The category selection is preserved in the URL across
          pages even where it does not affect measures.
        </p>
        <p>
          Source timestamps are timezone-free wall-clock values. No timezone
          conversion is applied. Trends group the selected days into Gregorian
          calendar months and show months with matching sales, rather than a
          zero-filled calendar. Dimensions describe attributes in the source
          snapshot, without historical SCD attribution.
        </p>
        <p>
          Only Status = 5 (shipped) is included in sales views. Facts retain
          other statuses. Customer order frequency refers only to the selected
          period. No retention, lifetime value, recognized revenue, currency
          conversion, returns, margin or current business performance is
          inferred.
        </p>
      </section>
      <section
        className="definitions-card"
        aria-labelledby="provenance-heading"
      >
        <h2 id="provenance-heading">Data provenance and limitations</h2>
        <dl>
          <div>
            <dt>Source mode</dt>
            <dd>
              {doc.provenance.mode === "offline_fixture"
                ? "Fictional deterministic demo; not actual AdventureWorks results."
                : "Real AdventureWorks-derived local export; not a live data feed."}
            </dd>
          </div>
          <div>
            <dt>Historical source period</dt>
            <dd>
              {doc.data.period.start || "empty"} to{" "}
              {doc.data.period.end || "empty"}
            </dd>
          </div>
          <div>
            <dt>Snapshot identity</dt>
            <dd>{doc.provenance.snapshot_id}</dd>
          </div>
          <div>
            <dt>Source extracted at</dt>
            <dd>
              {doc.provenance.source_extracted_at} (recorded timestamp; no
              automatic refresh)
            </dd>
          </div>
          <div>
            <dt>Input fingerprint</dt>
            <dd className="fingerprint">{doc.provenance.input_fingerprint}</dd>
          </div>
          <div>
            <dt>Analytics code revision</dt>
            <dd className="fingerprint">{doc.provenance.analytics_revision}</dd>
          </div>
          <div>
            <dt>Export code revision</dt>
            <dd className="fingerprint">
              {doc.provenance.export_revision} ·{" "}
              {doc.provenance.working_tree_dirty
                ? "modified working tree at export"
                : "clean working tree at export"}
            </dd>
          </div>
          <div>
            <dt>Validation and operation</dt>
            <dd>
              All six mart controls passed at export after independent
              source/model reconciliation. Exact composition uses scaled
              integers on the server. Real-derived data stays local and ignored;
              dataset redistribution provenance remains unresolved. Input hashes
              detect accidental corruption, not a malicious local writer.
              Refresh requires an explicit validated export and page reload.
              This app establishes no production security, crash durability, or
              serving-scale guarantee.
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}
