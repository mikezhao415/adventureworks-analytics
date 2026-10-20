import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import demo from "../data/demo.json";
import { dashboard, validateDocument } from "../lib/data";
import { Dashboard } from "../components/dashboard";
import { CustomersView } from "../components/customers";
import { comparisonWidths } from "../lib/comparison";
import { displayAmount } from "../lib/format";
import { Filters } from "../components/filters";
import { scalarFilters } from "../lib/navigation";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push }),
}));
vi.mock("recharts", async (original) => ({
  ...(await original<typeof import("recharts")>()),
  ResponsiveContainer: () => null,
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: import("react").ComponentProps<"a">) => (
    <a href={href}>{children}</a>
  ),
}));
const data = dashboard(validateDocument(demo));
const props = {
  data,
  context: data,
  defaults: data.filters,
  view: "overview" as const,
};
describe("page presentation and filter navigation", () => {
  it("renders only the selected page and source disclosure", () => {
    render(<Dashboard {...props} />);
    expect(screen.getByTestId("sales-kpi")).toHaveTextContent("$953,544");
    expect(
      screen.getByText("Fictional demonstration data"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Search customers" }),
    ).not.toBeInTheDocument();
  });
  it("keeps drafts local until Apply and resets through the URL", async () => {
    const user = userEvent.setup();
    push.mockClear();
    const apply = vi.fn(),
      reset = vi.fn();
    render(
      <Filters
        applied={data.filters}
        defaults={data.filters}
        context={data}
        pending={false}
        onApply={apply}
        onReset={reset}
      />,
    );
    const summary = screen.getByLabelText("Applied Filters");
    await user.click(screen.getByRole("checkbox", { name: "Northwest" }));
    expect(apply).not.toHaveBeenCalled();
    expect(summary).toHaveTextContent("All Territories");
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved Changes");
    await user.click(screen.getByRole("button", { name: "Apply Filters" }));
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({ territory: "1" }),
    );
    expect(summary).toHaveTextContent("All Territories");
    await user.click(screen.getByRole("button", { name: "Reset Filters" }));
    expect(reset).toHaveBeenCalledOnce();
  });
  it("renders KPI definitions accessibly without information icons", () => {
    render(<Dashboard {...props} />);
    expect(screen.queryByRole("button", { name: /About Net line sales/i })).not.toBeInTheDocument();
    expect(screen.queryByText("i", { selector: ".info" })).not.toBeInTheDocument();
    expect(screen.getByTestId("sales-kpi").closest("article")).toHaveAccessibleDescription(
      /Exact USD:/,
    );
    expect(screen.getByRole("link", { name: "Data & Definitions" })).toBeInTheDocument();
  });

  it("hides metrics when the URL is invalid", () => {
    render(<Dashboard {...props} data={null} error="Unknown filter" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Unknown filter");
    expect(screen.queryByTestId("analytics-content")).not.toBeInTheDocument();
  });
  it("does not rescale customer bars after search", async () => {
    const { container } = render(<CustomersView data={data} />);
    const first = data.customers[0];
    const selector = `[data-customer="${first.key}"] [data-metric="net_line_sales"]`;
    const width = container.querySelector(selector)?.getAttribute("data-width");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    const next = data.customers[8];
    expect(
      container
        .querySelector(
          `[data-customer="${next.key}"] [data-metric="net_line_sales"]`,
        )
        ?.getAttribute("data-width"),
    ).toBe(
      String(comparisonWidths(data.customers).get(next.key)?.net_line_sales),
    );
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search customers" }),
      first.name,
    );
    expect(container.querySelector(selector)?.getAttribute("data-width")).toBe(
      width,
    );
    expect(screen.getByText("1–1 of 1")).toBeInTheDocument();
  });
  it("scales each metric independently with explicit zero, identical and null behavior", () => {
    const base = data.customers[0];
    const rows = [
      {
        ...base,
        key: "a",
        order_count: 0,
        net_line_sales: "10.000000",
        average_order_value: null,
        contribution: "20.00",
      },
      {
        ...base,
        key: "b",
        order_count: 5,
        net_line_sales: "10.000000",
        average_order_value: "2.0000",
        contribution: "40.00",
      },
      {
        ...base,
        key: "c",
        order_count: 10,
        net_line_sales: "10.000000",
        average_order_value: "4.0000",
        contribution: "60.00",
      },
    ];
    const widths = comparisonWidths(rows);
    expect(widths.get("a")).toEqual({
      order_count: 0,
      net_line_sales: 100,
      average_order_value: null,
      contribution: 0,
    });
    expect(widths.get("b")?.order_count).toBe(50);
    expect(widths.get("b")?.contribution).toBe(50);
    expect(widths.get("b")?.average_order_value).toBe(0);
    expect(widths.get("c")?.average_order_value).toBe(100);
    expect(comparisonWidths([]).size).toBe(0);
    expect(
      comparisonWidths([
        { ...rows[0], net_line_sales: "0.000000", contribution: "0.00" },
      ]).get("a")?.net_line_sales,
    ).toBe(0);
  });
  it("rounds exact large amounts without Number precision loss and rejects repeated URL keys", () => {
    expect(displayAmount("9007199254740993.500000")).toBe(
      "$9,007,199,254,740,994",
    );
    expect(displayAmount(null)).toBe("—");
    expect(displayAmount("1234567.499999")).toBe("$1,234,567");
    expect(displayAmount("2449.5000")).toBe("$2,450");
    expect(displayAmount("0.000000")).toBe("$0");
    expect(() => scalarFilters({ territory: ["1", "2"] })).toThrow();
  });
});
