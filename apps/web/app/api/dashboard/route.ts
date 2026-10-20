import { dashboard, FilterError, loadDocument } from "../../../lib/data";
import { scalarFilters } from "../../../lib/navigation";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    for (const key of ["start", "end", "territory", "category"])
      if (params.getAll(key).length > 1)
        throw new FilterError("Duplicate filter");
    return Response.json(
      dashboard(
        await loadDocument(),
        scalarFilters(Object.fromEntries(params)),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof FilterError
            ? error.message
            : "Dashboard data is unavailable. Verify the configured export and retry.",
      },
      {
        status: error instanceof FilterError ? 400 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
