import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import demo from "../data/demo.json";
import { dashboard, validateDocument } from "../lib/data";
import { Dashboard } from "../components/dashboard";
import { Kpi } from "../components/kpi";
import { chartRows } from "../components/charts";
vi.mock("recharts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("recharts")>()),
  ResponsiveContainer: () => null,
}));
const initial = dashboard(validateDocument(demo));
describe("dashboard presentation", () => {
  it("renders all five sections, fixture identity, scope and KPI", () => {
    render(<Dashboard initial={initial} />);
    for (const title of [
      "Sales overview",
      "The sales trajectory",
      "The best sellers",
      "The customers behind the numbers",
      "Sales across regions",
    ])
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(
      screen.getByText("Fictional demonstration data"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("sales-kpi")).toHaveTextContent("953,544.31");
    expect(
      screen.getByText(/Category does not filter overview/),
    ).toBeInTheDocument();
  });
  it("applies supported filters and resets to the initial selection", async () => {
    const user = userEvent.setup();
    const mock = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        dashboard(
          validateDocument(demo),
          Object.fromEntries(new URL(url, "http://localhost").searchParams),
        ),
    }));
    vi.stubGlobal("fetch", mock);
    render(<Dashboard initial={initial} />);
    await user.selectOptions(screen.getByLabelText("Territory"), "1");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() => expect(mock).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.getByTestId("sales-kpi")).not.toHaveTextContent(
        "953,544.31",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    await waitFor(() =>
      expect(screen.getByTestId("sales-kpi")).toHaveTextContent("953,544.31"),
    );
    vi.unstubAllGlobals();
  });
  it("retains active values and shows an actionable request error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Invalid date range" }),
      }),
    );
    render(<Dashboard initial={initial} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Apply filters" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Filters could not be applied",
    );
    expect(screen.getByTestId("sales-kpi")).toHaveTextContent("953,544.31");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
  it("provides empty states and a null AOV", () => {
    const empty = dashboard(validateDocument(demo), {
      start: "2020-01-01",
      end: "2020-01-02",
    });
    render(<Dashboard initial={empty} />);
    expect(
      screen.getAllByText("No shipped sales match this selection.").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("article", { name: "Average order value" }),
    ).toHaveTextContent("—");
  });
  it("searches customer identifiers", async () => {
    render(<Dashboard initial={initial} />);
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search customers" }),
      "00024",
    );
    expect(
      screen.getByRole("table", { name: "Customer sales rankings" }),
    ).toHaveTextContent("Customer 00024");
    expect(screen.getByText("1–1 of 1")).toBeInTheDocument();
  });
  it("formats reusable KPIs and transforms chart coordinates without altering exact values", () => {
    render(
      <Kpi
        label="Sales"
        value="1,000.00"
        detail="Exact source units"
        description="No currency conversion"
      />,
    );
    expect(screen.getByRole("article", { name: "Sales" })).toHaveTextContent(
      "1,000.00",
    );
    const r = chartRows(initial.monthly)[0];
    expect(r.net_line_sales).toBe(initial.monthly[0].net_line_sales);
    expect(r.sales).toBe(Number(r.net_line_sales));
    expect(r.label).toMatch(/Jan/);
  });
});
