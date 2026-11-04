import { Suspense } from "react";
import LineageViewer from "../../components/lineage-viewer";
import { loadLineage } from "../../lib/lineage-server";
import "./lineage.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Data lineage | AdventureWorks Analytics" };
export default async function LineagePage() {
  let doc;
  try {
    doc = await loadLineage();
  } catch {
    return (
      <section className="lineage-page">
        <h1>Data lineage</h1>
        <p>Custom visualization of dbt-derived sales lineage.</p>
        <p role="alert">
          Lineage metadata is unavailable because no valid, explicitly approved
          artifact could be loaded. No substitute data or native viewer has been
          loaded.
        </p>
      </section>
    );
  }
  return (
    <section className="lineage-page">
      <h1>Data lineage</h1>
      <p>
        Custom visualization of dbt-derived sales lineage. Six models, two
        sources and nine direct dependencies.
      </p>
      <p>
        Explore the sales summary’s transformation dependencies. Dashboard date,
        territory and category filters do not affect this graph.
      </p>
      <Suspense fallback={<p role="status">Loading lineage exploration…</p>}>
        <LineageViewer doc={doc} />
      </Suspense>
    </section>
  );
}
