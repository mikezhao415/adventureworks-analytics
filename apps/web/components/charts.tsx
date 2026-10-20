"use client";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { compactUSD, displayAmount, money, shortMonth } from "../lib/format";
import type { DashboardData } from "../lib/data";
const COLORS = ["#315f52", "#75a28e", "#b0c4b7", "#cfac73", "#8c9fa7"];
export function chartRows(rows: DashboardData["monthly"]) {
  return rows.map((r) => ({
    ...r,
    label: shortMonth(r.month),
    sales: Number(r.net_line_sales),
  }));
}
export function SalesTrend({ rows }: { rows: DashboardData["monthly"] }) {
  const data = chartRows(rows);
  return (
    <div
      className="chart"
      role="img"
      aria-label="Monthly net line sales and order count. Exact values are available in the table below."
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart
          data={data}
          margin={{ top: 15, right: 4, bottom: 8, left: 0 }}
          accessibilityLayer
        >
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#52816c" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#52816c" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e9ece7" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            minTickGap={40}
            tick={{ fill: "#52685c", fontSize: 14 }}
            dy={12}
          />
          <YAxis
            yAxisId="sales"
            tickFormatter={compactUSD}
            tickLine={false}
            axisLine={false}
            width={65}
            tick={{ fill: "#52685c", fontSize: 14 }}
          />
          <YAxis
            yAxisId="orders"
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={45}
            tick={{ fill: "#806239", fontSize: 14 }}
          />
          <Tooltip
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as
                (typeof data)[number] | undefined;
              return active && r ? (
                <div className="chart-tooltip">
                  <strong>{r.label}</strong>
                  <p>Net line sales: {displayAmount(r.net_line_sales)}</p>
                  <small>Exact USD: {money(r.net_line_sales)}</small>
                  <p>Orders: {r.order_count}</p>
                </div>
              ) : null;
            }}
          />
          <Area
            yAxisId="sales"
            type="monotone"
            dataKey="sales"
            stroke="#315f52"
            strokeWidth={2.5}
            fill="url(#salesFill)"
            isAnimationActive={false}
          />
          <Line
            yAxisId="orders"
            type="monotone"
            dataKey="order_count"
            stroke="#b08b53"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
export function CategoryChart({ rows }: { rows: DashboardData["categories"] }) {
  const data = rows.map((r) => ({ ...r, sales: Number(r.net_line_sales) }));
  return (
    <div
      className="category-chart"
      role="img"
      aria-label="Net line sales by category. Exact values are available in the table below."
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 0, right: 24, top: 5, bottom: 0 }}
          accessibilityLayer
        >
          <CartesianGrid horizontal={false} stroke="#edf0eb" />
          <XAxis
            type="number"
            tickFormatter={compactUSD}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#52685c", fontSize: 14 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#394a41", fontSize: 14 }}
          />
          <Tooltip
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as
                (typeof data)[number] | undefined;
              return active && r ? (
                <div className="chart-tooltip">
                  <strong>{r.name}</strong>
                  <p>{displayAmount(r.net_line_sales)} net line sales</p>
                  <small>Exact USD: {money(r.net_line_sales)}</small>
                  <p>{r.units_sold} units</p>
                </div>
              ) : null;
            }}
          />
          <Bar
            dataKey="sales"
            radius={[0, 4, 4, 0]}
            barSize={24}
            isAnimationActive={false}
          >
            {data.map((r, i) => (
              <Cell key={r.key} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
