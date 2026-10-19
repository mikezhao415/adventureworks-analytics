import { Dashboard } from "../components/dashboard";
import { dashboard, loadDocument } from "../lib/data";
export const dynamic = "force-dynamic";
export default async function Page() {
  try {
    return <Dashboard initial={dashboard(await loadDocument())} />;
  } catch {
    return (
      <main className="standalone">
        <p className="eyebrow">ADVENTUREWORKS / SALES INTELLIGENCE</p>
        <h1>Dashboard data unavailable</h1>
        <p role="alert">
          The configured export is missing, invalid, or failed integrity checks.
          No fallback data has been substituted.
        </p>
        <p>
          Check the local export and AW_DASHBOARD_DATA setting, then reload.
        </p>
        <a href="/">Try again</a>
      </main>
    );
  }
}
