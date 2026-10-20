import { AnalyticsPage } from "../../components/analytics-page";
import type { PageSearchParams } from "../../lib/navigation";
export const dynamic = "force-dynamic";
export default function Page({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  return <AnalyticsPage view="products" searchParams={searchParams} />;
}
