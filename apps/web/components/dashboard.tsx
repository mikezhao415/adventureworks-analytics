"use client";
import { useRef, useState, useEffect, type FormEvent } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  Database,
  Globe2,
  LayoutDashboard,
  Package,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import type { DashboardData } from "../lib/data";
import type { Filter } from "../lib/schema";
import { count, METRICS, money, shortMonth } from "../lib/format";
import { Kpi } from "./kpi";
import { CategoryChart, SalesTrend } from "./charts";

function Panel({
  id,
  kicker,
  title,
  subtitle,
  children,
  action,
}: {
  id: string;
  kicker: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="panel" id={id} aria-labelledby={`${id}-title`}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{kicker}</p>
          <h2 id={`${id}-title`}>{title}</h2>
          {subtitle ? <p className="muted panel-subtitle">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Empty({
  text = "No shipped sales match this selection.",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <BarChart3 size={25} aria-hidden="true" />
      <p>{text}</p>
      <span>Try a wider date range or reset the filters.</span>
    </div>
  );
}
function ExactTable({
  children,
  caption,
}: {
  children: React.ReactNode;
  caption: string;
}) {
  return (
    <details className="exact">
      <summary>View exact data</summary>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label={caption}
      >
        <table>
          <caption className="sr-only">{caption}</caption>
          {children}
        </table>
      </div>
    </details>
  );
}
export function Dashboard({ initial }: { initial: DashboardData }) {
  const [data, setData] = useState(initial),
    [draft, setDraft] = useState<Filter>(initial.filters),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [search, setSearch] = useState(""),
    [sort, setSort] = useState("sales"),
    [page, setPage] = useState(0);
  const request = useRef<AbortController | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    return () => request.current?.abort();
  }, []);
  async function apply(filters: Filter) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        "/api/dashboard?" + new URLSearchParams(filters),
        { signal: controller.signal },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Unable to load dashboard data.");
      if (!controller.signal.aborted) {
        setData(result);
        setPage(0);
      }
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error ? e.message : "Unable to update the dashboard.",
        );
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void apply(draft);
  }
  function reset() {
    setDraft(initial.filters);
    setSearch("");
    setPage(0);
    void apply(initial.filters);
  }
  const visible = data.customers
    .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === "orders"
        ? b.order_count - a.order_count
        : sort === "name"
          ? a.name.localeCompare(b.name)
          : 0,
    );
  const selectedCategory = data.options.categories.find(
    (c) => String(c.key) === data.filters.category,
  )?.name;
  const demo = data.provenance.mode === "offline_fixture";
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to sales overview
      </a>
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="AdventureWorks home">
          <span className="brand-mark">
            <Activity size={23} />
          </span>
          <span>
            adventureworks<span className="brand-sub">ANALYTICS WORKSPACE</span>
          </span>
        </a>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Dashboard sections">
          <a className="nav-active" href="#overview">
            <LayoutDashboard size={17} />
            Sales overview
            <ChevronRight size={14} />
          </a>
          <a href="#trends">
            <BarChart3 size={17} />
            Sales trends
          </a>
          <a href="#products">
            <Package size={17} />
            Products
          </a>
          <a href="#customers">
            <Users size={17} />
            Customers
          </a>
          <a href="#territories">
            <Globe2 size={17} />
            Territories
          </a>
        </nav>
        <div className="sidebar-bottom">
          <ShieldCheck size={20} />
          <strong>Built on trusted data</strong>
          <p>
            Validated snapshots.
            <br />
            Reconciled sales metrics.
          </p>
          <a href="#methodology">
            Explore the metric contract <ArrowUpRight size={13} />
          </a>
        </div>
        <div className="sidebar-footer">
          <span className="avatar">AW</span>
          <span>
            Sales intelligence<small>Historical analysis</small>
          </span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            Workspace <ChevronRight size={12} /> <strong>Sales overview</strong>
          </div>
          <span className="topbar-status">
            <span className="status-dot" />
            {demo ? "Fictional demo" : "Validated local export"}
          </span>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="page-heading" id="overview">
            <div>
              <p className="eyebrow">THE BIG PICTURE</p>
              <h1>Sales overview</h1>
              <p className="intro">
                A clearer view of sales. From the first order to the last mile.
              </p>
            </div>
            <a className="source-link" href="#methodology">
              <Database size={15} />
              Data & definitions
              <ArrowUpRight size={14} />
            </a>
          </div>
          <div className="context-banner">
            <span className="context-icon">
              <ShieldCheck size={18} />
            </span>
            <p>
              <strong>
                {demo
                  ? "Fictional demonstration data"
                  : "Historical AdventureWorks data"}
              </strong>
              <span>
                {demo
                  ? "Deterministic fixtures — not actual AdventureWorks results."
                  : "A validated local snapshot — not a live sales feed."}{" "}
                Source period {data.period.start || "empty"} to{" "}
                {data.period.end || "empty"}. Amounts are source monetary units;
                currency is unspecified.
              </span>
            </p>
            <span className="context-tag">
              {demo ? "DEMO MODE" : "LOCAL SNAPSHOT"}
            </span>
          </div>
          <form
            className="filterbar"
            onSubmit={submit}
            aria-label="Dashboard filters"
          >
            <span className="filter-icon">
              <SlidersHorizontal size={17} />
              <span>Filters</span>
            </span>
            <label>
              From
              <input
                disabled={!ready}
                aria-label="Start date"
                type="date"
                value={draft.start}
                onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                required
              />
            </label>
            <label>
              To
              <input
                disabled={!ready}
                aria-label="End date"
                type="date"
                value={draft.end}
                onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                required
              />
            </label>
            <label>
              Territory
              <select
                disabled={!ready}
                aria-label="Territory"
                value={draft.territory}
                onChange={(e) =>
                  setDraft({ ...draft, territory: e.target.value })
                }
              >
                <option value="all">All territories</option>
                {data.options.territories.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category · product views
              <select
                disabled={!ready}
                aria-label="Product category"
                value={draft.category}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value })
                }
              >
                <option value="all">All categories</option>
                {data.options.categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button-primary"
              type="submit"
              disabled={!ready || pending}
            >
              {pending ? "Applying…" : "Apply filters"}
            </button>
            <button
              className="button-reset"
              type="button"
              onClick={reset}
              aria-label="Reset filters"
            >
              <RotateCcw size={15} />
              <span>Reset</span>
            </button>
          </form>
          <div className="active-filters" aria-live="polite">
            <span className="status-dot" />
            <strong>
              {data.filters.start} — {data.filters.end}
            </strong>
            <span>
              ·{" "}
              {data.filters.territory === "all"
                ? "All territories"
                : data.options.territories.find(
                    (t) => String(t.key) === data.filters.territory,
                  )?.name}
            </span>
            {selectedCategory ? (
              <span className="filter-chip">
                {selectedCategory} · products & categories only
              </span>
            ) : null}
            <span className="filter-explainer">
              Category does not filter overview, trends, customers or
              territories.
            </span>
          </div>
          {error ? (
            <div className="error-banner" role="alert">
              <strong>Filters could not be applied.</strong> {error} Displayed
              values still use the active filters above.
              <button type="button" onClick={() => void apply(draft)}>
                Retry
              </button>
            </div>
          ) : null}
          <div
            aria-busy={pending}
            className={
              pending ? "dashboard-content is-loading" : "dashboard-content"
            }
          >
            <div className="kpi-grid">
              <Kpi
                label={METRICS.sales.label}
                value={money(data.summary.net_line_sales, 2)}
                detail="Excludes tax & freight · all categories"
                description={`${METRICS.sales.description} Exact: ${money(data.summary.net_line_sales)}`}
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
                value={money(data.summary.average_order_value)}
                detail="Header subtotal per order"
                description={METRICS.aov.description}
              />
              <Kpi
                label={METRICS.units.label}
                value={count(data.summary.units_sold)}
                detail="Across all product categories"
                description={METRICS.units.description}
              />
            </div>
            <div className="charts-grid">
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
                {data.monthly.length ? (
                  <SalesTrend rows={data.monthly} />
                ) : (
                  <Empty />
                )}
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
                        <td>{money(r.net_line_sales)}</td>
                        <td>{count(r.order_count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </ExactTable>
              </Panel>
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
                  <strong>
                    {selectedCategory
                      ? money(
                          data.categories[0]?.net_line_sales || "0.000000",
                          2,
                        )
                      : money(data.summary.net_line_sales, 2)}
                  </strong>
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
                        <td>{money(r.net_line_sales)}</td>
                        <td>{r.order_count}</td>
                        <td>{r.units_sold}</td>
                      </tr>
                    ))}
                  </tbody>
                </ExactTable>
              </Panel>
            </div>
            <div className="detail-grid">
              <Panel
                id="products"
                kicker="PRODUCT PERFORMANCE"
                title="The best sellers"
                subtitle="Ranked by net line sales · selected category"
                action={
                  <span className="panel-badge">
                    Top 8 of {data.products.length}
                  </span>
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
                                  Product {r.key} · {count(r.order_count)}{" "}
                                  orders*
                                </small>
                              </span>
                            </th>
                            <td>{count(r.units_sold)}</td>
                            <td title={money(r.net_line_sales)}>
                              {money(r.net_line_sales, 2)}
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
                          <span title={money(r.net_line_sales)}>
                            {money(r.net_line_sales, 2)}
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
                          <span>AOV {money(r.average_order_value)}</span>
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
                        <td>{money(r.net_line_sales)}</td>
                        <td>{r.order_count}</td>
                        <td>{money(r.average_order_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </ExactTable>
              </Panel>
            </div>
            <Panel
              id="customers"
              kicker="CUSTOMER INSIGHTS"
              title="The customers behind the numbers"
              subtitle="Sales contribution and order frequency in the selected period · all categories"
              action={
                <span className="panel-badge">
                  {count(data.customers.length)} customers with sales
                </span>
              }
            >
              <div className="table-tools">
                <label className="search">
                  <Search size={16} />
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
                  <table>
                    <caption className="sr-only">
                      Customer sales rankings
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
                      {visible.slice(page * 8, page * 8 + 8).map((r) => (
                        <tr key={r.key}>
                          <th scope="row">
                            <span className="customer-icon">
                              {r.name.slice(-2)}
                            </span>
                            {r.name}
                          </th>
                          <td>{count(r.order_count)}</td>
                          <td title={money(r.net_line_sales)}>
                            {money(r.net_line_sales, 2)}
                          </td>
                          <td>
                            <span className="contribution-track">
                              <i style={{ width: r.contribution + "%" }} />
                            </span>
                            {r.contribution}%
                          </td>
                          <td>{money(r.average_order_value)}</td>
                        </tr>
                      ))}
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
          </div>
          <section
            id="methodology"
            className="methodology"
            aria-labelledby="methodology-title"
          >
            <div>
              <ShieldCheck size={21} />
              <h2 id="methodology-title">A transparent view of the numbers</h2>
            </div>
            <p>
              Net line sales preserve six decimals; headline amounts round to
              two. AOV uses four-decimal header subtotal divided by shipped
              orders. No currency conversion, recognized revenue, retention,
              lifetime value, or current performance is inferred. Dimensions
              reflect the source snapshot.
            </p>
            <details>
              <summary>Metric definitions & data provenance</summary>
              <dl>
                {Object.values(METRICS).map((m) => (
                  <div key={m.label}>
                    <dt>{m.label}</dt>
                    <dd>{m.description}</dd>
                  </div>
                ))}
                <div>
                  <dt>Snapshot identity</dt>
                  <dd>{data.provenance.snapshot_id}</dd>
                </div>
                <div>
                  <dt>Source extracted at</dt>
                  <dd>
                    {data.provenance.source_extracted_at} (recorded source
                    timestamp; not a live refresh)
                  </dd>
                </div>
                <div>
                  <dt>Input fingerprint</dt>
                  <dd className="fingerprint">
                    {data.provenance.input_fingerprint}
                  </dd>
                </div>
                <div>
                  <dt>Analytics code revision</dt>
                  <dd className="fingerprint">
                    {data.provenance.analytics_revision}
                  </dd>
                </div>
                <div>
                  <dt>Export code revision</dt>
                  <dd className="fingerprint">
                    {data.provenance.export_revision}
                    {data.provenance.working_tree_dirty
                      ? " · working tree modified at export"
                      : " · clean working tree at export"}
                  </dd>
                </div>
                <div>
                  <dt>Validation</dt>
                  <dd>
                    All six mart controls passed at export. Exact sums are
                    composed on the server; category filters affect product and
                    category views only. Date boundaries include the complete
                    selected calendar days, with no timezone conversion. No
                    automatic refresh.
                  </dd>
                </div>
              </dl>
            </details>
          </section>
          <footer className="page-footer">
            <span>
              ADVENTUREWORKS <span className="footer-slash">/</span> SALES
              INTELLIGENCE
            </span>
            <span>Historical data. Clearly defined metrics.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
