"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { PageDataByView } from "../lib/page-data";
import { comparisonWidths, type ComparisonMetric } from "../lib/comparison";
import { count, money, displayAmount } from "../lib/format";
import { Panel, Empty } from "./panels";
export function ComparisonValue({
  width,
  value,
  exact,
  metric,
}: {
  width: number | null;
  value: string;
  exact?: string;
  metric: ComparisonMetric;
}) {
  return (
    <span className="relative-value">
      <span
        className="comparison-track"
        aria-hidden="true"
        data-metric={metric}
        data-width={width ?? "unavailable"}
      >
        <i style={{ width: `${width ?? 0}%` }} />
      </span>
      <span>
        {value}
        {exact ? <small>Exact USD: {exact}</small> : null}
      </span>
    </span>
  );
}
export function CustomersView({ data }: { data: PageDataByView["customers"] }) {
  const customers = useMemo(
    () =>
      data.customerValues.map(
        ([
          key,
          name,
          order_count,
          net_line_sales,
          contribution,
          average_order_value,
        ]) => ({
          key,
          name,
          order_count,
          net_line_sales,
          contribution,
          average_order_value,
        }),
      ),
    [data.customerValues],
  );
  const [search, setSearch] = useState(""),
    [sort, setSort] = useState("sales"),
    [page, setPage] = useState(0);
  const widths = useMemo(() => comparisonWidths(customers), [customers]);
  const visible = customers
    .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === "orders"
        ? b.order_count - a.order_count
        : sort === "name"
          ? a.name.localeCompare(b.name)
          : sort === "aov"
            ? BigInt((b.average_order_value || "0.0000").replace(".", "")) >
              BigInt((a.average_order_value || "0.0000").replace(".", ""))
              ? 1
              : BigInt((b.average_order_value || "0.0000").replace(".", "")) <
                  BigInt((a.average_order_value || "0.0000").replace(".", ""))
                ? -1
                : 0
            : 0,
    );
  return (
    <Panel
      id="customer-comparison"
      kicker="CUSTOMER PERFORMANCE"
      title="The customers behind the numbers"
      subtitle="Sales and order frequency in the selected period · all categories"
      action={
        <span className="panel-badge">
          {count(customers.length)} customers with sales
        </span>
      }
    >
      <p className="comparison-note">
        Relative comparisons: each column runs from its own observed minimum to
        maximum across all {count(customers.length)} customers matching the
        applied date and territory. Search and pagination do not rescale bars.
        Bar lengths are not shares of a total. Identical positive values fill
        the bar; zeros stay empty.
      </p>
      <div className="table-tools">
        <label className="search">
          <Search size={19} aria-hidden="true" />
          <span className="sr-only">Search customers</span>
          <input
            placeholder="Search customer ID…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="sort">
          Sort by
          <select
            aria-label="Sort customers"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(0);
            }}
          >
            <option value="sales">Net line sales</option>
            <option value="orders">Order frequency</option>
            <option value="aov">Average order value</option>
            <option value="name">Customer ID</option>
          </select>
        </label>
      </div>
      {visible.length ? (
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Customer sales table"
        >
          <table className="customer-table">
            <caption className="sr-only">
              Customer sales rankings with independently scaled relative
              comparison bars
            </caption>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Orders</th>
                <th>Net line sales</th>
                <th>Sales contribution</th>
                <th>Average order value</th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(page * 8, page * 8 + 8).map((r) => {
                const w = widths.get(r.key)!;
                return (
                  <tr key={r.key} data-customer={r.key}>
                    <th scope="row">
                      <span className="customer-icon">{r.name.slice(-2)}</span>
                      {r.name}
                    </th>
                    <td>
                      <ComparisonValue
                        width={w.order_count}
                        value={count(r.order_count)}
                        metric="order_count"
                      />
                    </td>
                    <td>
                      <ComparisonValue
                        width={w.net_line_sales}
                        value={displayAmount(r.net_line_sales)}
                        exact={money(r.net_line_sales)}
                        metric="net_line_sales"
                      />
                    </td>
                    <td>
                      <ComparisonValue
                        width={w.contribution}
                        value={r.contribution + "%"}
                        metric="contribution"
                      />
                    </td>
                    <td>
                      <ComparisonValue
                        width={w.average_order_value}
                        value={displayAmount(r.average_order_value)}
                        exact={money(r.average_order_value)}
                        metric="average_order_value"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty text="No customers match your search or filters." />
      )}
      <div className="pagination">
        <span>
          {visible.length
            ? `${page * 8 + 1}–${Math.min(page * 8 + 8, visible.length)} of ${count(visible.length)}`
            : "0 customers"}
        </span>
        <div>
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={(page + 1) * 8 >= visible.length}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </Panel>
  );
}
