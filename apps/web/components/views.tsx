"use client";
import { Globe2 } from "lucide-react";
import type { PageDataByView } from "../lib/page-data";
import {
  count,
  money,
  displayAmount,
  METRICS,
  shortMonth,
} from "../lib/format";
import { Kpi } from "./kpi";
import { SalesTrend, CategoryChart } from "./charts";
import { Panel, Empty, ExactTable } from "./panels";

export function OverviewView({ data }: { data: PageDataByView["overview"] }) {
  return (
    <>
      <div className="kpi-grid">
        <Kpi
          label={METRICS.sales.label}
          value={displayAmount(data.summary.net_line_sales)}
          detail="Excludes tax & freight · all categories"
          description={`${METRICS.sales.description} Exact USD: ${money(data.summary.net_line_sales)}`}
          accent
        />
        <Kpi
          label={METRICS.orders.label}
          value={count(data.summary.order_count)}
          detail="Shipped orders · status 5"
          description={METRICS.orders.description}
        />
        <Kpi
          label={METRICS.aov.label}
          value={displayAmount(data.summary.average_order_value)}
          detail="Header subtotal per order"
          description={`${METRICS.aov.description} Exact USD: ${money(data.summary.average_order_value)}`}
        />
        <Kpi
          label={METRICS.units.label}
          value={count(data.summary.units_sold)}
          detail="Across all product categories"
          description={METRICS.units.description}
        />
      </div>
      <Panel
        id="selected-period"
        kicker="SELECTED PERIOD"
        title="The numbers in context"
        subtitle="Shipped orders in the active date range and order territory"
      >
        <dl className="overview-facts">
          <div>
            <dt>Header subtotal</dt>
            <dd>
              {displayAmount(data.summary.header_subtotal)}
              <small>Exact USD: {money(data.summary.header_subtotal)}</small>
            </dd>
          </div>
          <div>
            <dt>Months with shipped sales</dt>
            <dd>{count(data.counts.months)}</dd>
          </div>
          <div>
            <dt>Customers with shipped sales</dt>
            <dd>{count(data.counts.customers)}</dd>
          </div>
          <div>
            <dt>Territories with shipped sales</dt>
            <dd>
              {count(data.counts.territories)}
              <small>Based on order territory, across all categories.</small>
            </dd>
          </div>
        </dl>
        <p className="footnote">
          Sales and header subtotal retain different source precision. Display
          amounts round only after aggregation. Full calculation rules are on
          the definitions page.
        </p>
      </Panel>
    </>
  );
}
export function TrendsView({ data }: { data: PageDataByView["trends"] }) {
  return (
    <Panel
      id="trends"
      kicker="PERFORMANCE OVER TIME"
      title="The sales trajectory"
      subtitle="Daily selections, grouped into calendar months"
      action={
        <span className="panel-badge">
          {data.monthly.length} months with sales
        </span>
      }
    >
      <div className="legend">
        <span>
          <i />
          Net line sales
        </span>
        <span>
          <i className="gold" />
          Orders · right axis
        </span>
      </div>
      {data.monthly.length ? <SalesTrend rows={data.monthly} /> : <Empty />}
      <ExactTable caption="Exact monthly sales and orders">
        <thead>
          <tr>
            <th>Month</th>
            <th>Net line sales</th>
            <th>Orders</th>
          </tr>
        </thead>
        <tbody>
          {data.monthly.map((r) => (
            <tr key={r.month}>
              <th scope="row">{shortMonth(r.month)}</th>
              <td title={`Exact USD: ${money(r.net_line_sales)}`}>
                {displayAmount(r.net_line_sales)}
              </td>
              <td>{count(r.order_count)}</td>
            </tr>
          ))}
        </tbody>
      </ExactTable>
    </Panel>
  );
}
export function ProductsView({ data }: { data: PageDataByView["products"] }) {
  const selectedCategory =
    data.filters.category !== "all"
      ? data.options.categories
          .filter((c) =>
            data.filters.category.split(",").includes(String(c.key)),
          )
          .map((c) => c.name)
          .join(", ")
      : undefined;
  return (
    <div className="products-grid">
      <Panel
        id="categories"
        kicker="SALES MIX"
        title="What drives sales"
        subtitle={
          selectedCategory
            ? `Category filter: ${selectedCategory}`
            : "Net line sales by product category"
        }
      >
        {data.categories.length ? (
          <CategoryChart rows={data.categories} />
        ) : (
          <Empty />
        )}
        <div className="category-total">
          <span>Selected category sales</span>
          <strong>{displayAmount(data.category_net_line_sales)}</strong>
        </div>
        <ExactTable caption="Exact category sales">
          <thead>
            <tr>
              <th>Category</th>
              <th>Net line sales</th>
              <th>Orders*</th>
              <th>Units</th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.name}</th>
                <td title={`Exact USD: ${money(r.net_line_sales)}`}>
                  {displayAmount(r.net_line_sales)}
                </td>
                <td>{r.order_count}</td>
                <td>{r.units_sold}</td>
              </tr>
            ))}
          </tbody>
        </ExactTable>
      </Panel>
      <Panel
        id="products"
        kicker="PRODUCT PERFORMANCE"
        title="The best sellers"
        subtitle="Ranked by net line sales · selected category"
        action={
          <span className="panel-badge">Top 8 of {data.products.length}</span>
        }
      >
        {data.products.length ? (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Product performance table"
          >
            <table>
              <caption className="sr-only">Top products</caption>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Units</th>
                  <th>Net line sales</th>
                </tr>
              </thead>
              <tbody>
                {data.products.slice(0, 8).map((r, i) => (
                  <tr key={r.key}>
                    <th scope="row">
                      <span className="rank">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>
                        {r.name}
                        <small>
                          Product {r.key} · {count(r.order_count)} orders*
                        </small>
                      </span>
                    </th>
                    <td>{count(r.units_sold)}</td>
                    <td title={`Exact USD: ${money(r.net_line_sales)}`}>
                      {displayAmount(r.net_line_sales)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
        <p className="footnote">
          * Product/category order counts overlap and must not be added.
        </p>
      </Panel>
    </div>
  );
}
export function TerritoriesView({
  data,
}: {
  data: PageDataByView["territories"];
}) {
  return (
    <Panel
      id="territories"
      kicker="TERRITORY PERFORMANCE"
      title="Sales across regions"
      subtitle="Order territory · all categories"
    >
      {data.territories.length ? (
        <div className="territory-list">
          {data.territories.map((r, i) => (
            <div className="territory-row" key={r.key}>
              <div className="territory-title">
                <span className="territory-icon">
                  <Globe2 size={17} />
                </span>
                <strong>{r.name}</strong>
                <span title={`Exact USD: ${money(r.net_line_sales)}`}>
                  {displayAmount(r.net_line_sales)}
                </span>
              </div>
              <div className="territory-bar">
                <span
                  style={{
                    width: `${data.territories[0] ? Math.max(1, (Number(r.net_line_sales) / Number(data.territories[0].net_line_sales)) * 100) : 0}%`,
                    background: i === 0 ? "#315f52" : "#a7beb0",
                  }}
                />
              </div>
              <div className="territory-meta">
                <span>{count(r.order_count)} orders</span>
                <span>AOV {displayAmount(r.average_order_value)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty />
      )}
      <ExactTable caption="Exact territory sales">
        <thead>
          <tr>
            <th>Territory</th>
            <th>Net line sales</th>
            <th>Orders</th>
            <th>AOV</th>
          </tr>
        </thead>
        <tbody>
          {data.territories.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.name}</th>
              <td title={`Exact USD: ${money(r.net_line_sales)}`}>
                {displayAmount(r.net_line_sales)}
              </td>
              <td>{r.order_count}</td>
              <td title={`Exact USD: ${money(r.average_order_value)}`}>
                {displayAmount(r.average_order_value)}
              </td>
            </tr>
          ))}
        </tbody>
      </ExactTable>
    </Panel>
  );
}
