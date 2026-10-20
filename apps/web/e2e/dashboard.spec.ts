import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PAGES } from "../lib/navigation";
test("drafts, unions, persistence, browser history and reset", async ({
  page,
}) => {
  await page.goto("/?utm_source=chatgpt.com");
  await expect(page.getByTestId("sales-kpi")).toHaveText("$953,544");
  await page
    .getByRole("navigation", { name: "Analytics pages" })
    .getByRole("link", { name: "Filters", exact: true })
    .click();
  const applied = page.locator("#main").getByLabel("Applied Filters");
  await page.getByRole("checkbox", { name: "Northwest", exact: true }).check();
  await page.getByRole("checkbox", { name: "Southwest", exact: true }).check();
  await page.getByRole("checkbox", { name: "Bikes", exact: true }).check();
  await expect(page.getByRole("status")).toHaveText("Unsaved Changes");
  await expect(applied).toContainText("All Territories");
  await expect(applied).toContainText("All Categories");
  await page
    .locator("nav")
    .getByRole("link", { name: "Sales Overview", exact: true })
    .click();
  await expect(page.getByTestId("sales-kpi")).toHaveText("$953,544");
  await page
    .getByRole("navigation", { name: "Analytics pages" })
    .getByRole("link", { name: "Filters", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Northwest", exact: true }),
  ).not.toBeChecked();
  await page.getByRole("checkbox", { name: "Northwest", exact: true }).check();
  await page
    .getByRole("button", { name: "Apply Filters", exact: true })
    .click();
  await expect(page).toHaveURL(/territory=1/);
  await expect(applied).toContainText("Northwest");
  await page.getByRole("checkbox", { name: "Southwest", exact: true }).check();
  await page.getByRole("checkbox", { name: "Bikes", exact: true }).check();
  await expect(applied).not.toContainText("Southwest");
  await page
    .getByRole("button", { name: "Apply Filters", exact: true })
    .click();
  await expect(page).toHaveURL(/territory=1%2C2/);
  await expect(applied).toContainText("Southwest");
  await page.reload();
  await expect(applied).toContainText("Southwest");
  await page.goBack();
  await expect(applied).not.toContainText("Southwest");
  await expect(
    page.getByRole("checkbox", { name: "Southwest", exact: true }),
  ).not.toBeChecked();
  await page.goForward();
  await expect(applied).toContainText("Southwest");
  await page
    .locator("nav")
    .getByRole("link", { name: "Sales Overview", exact: true })
    .click();
  const selected = await page.getByTestId("sales-kpi").textContent();
  await page
    .getByRole("navigation", { name: "Analytics pages" })
    .getByRole("link", { name: "Filters", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "All Categories", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Apply Filters", exact: true })
    .click();
  await page
    .locator("nav")
    .getByRole("link", { name: "Sales Overview", exact: true })
    .click();
  await expect(page.getByTestId("sales-kpi")).toHaveText(selected!);
  await page
    .getByRole("navigation", { name: "Analytics pages" })
    .getByRole("link", { name: "Filters", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reset Filters", exact: true })
    .click();
  await expect(page).toHaveURL(/\/filters$/);
  await expect(applied).toContainText("All Territories");
  await page
    .locator("nav")
    .getByRole("link", { name: "Sales Overview", exact: true })
    .click();
  await expect(page.getByTestId("sales-kpi")).toHaveText("$953,544");
});
test("page titles, responsive accessibility, USD tables and icon-free KPIs", async ({
  page,
}) => {
  for (const item of PAGES) {
    await page.goto(item.path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      item.title,
    );
    await expect(page).toHaveTitle(item.title + " | AdventureWorks Analytics");
    await expect(page.locator('nav a[aria-current="page"]')).toHaveAttribute(
      "href",
      item.path,
    );
    await expect(
      page.getByText("Validated sales metrics", { exact: true }),
    ).toHaveCount(0);
    if (item.path !== "/filters")
      await expect(
        page.getByRole("button", { name: "Apply Filters" }),
      ).toHaveCount(0);
    if (
      process.env.CAPTURE_DASHBOARD_SCREENSHOTS === "1" &&
      ["/", "/customers", "/filters"].includes(item.path)
    ) {
      await page.screenshot({
        path: `../../docs/screenshots/sales-dashboard${item.path === "/" ? "" : "-" + item.path.slice(1)}-${test.info().project.name}.png`,
        scale: "css",
        fullPage:
          test.info().project.name === "mobile" || item.path === "/filters",
      });
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /About Net line sales/i }),
  ).toHaveCount(0);
  await expect(page.locator(".metric-popover")).toHaveCount(0);
  await expect(
    page.locator("#main").getByRole("link", { name: "Data & Definitions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Configure Filters", exact: true }),
  ).toHaveCount(0);
  for (const [path, caption] of [
    ["/trends", "Exact monthly sales and orders"],
    ["/territories", "Exact territory sales"],
  ]) {
    await page.goto(path);
    await page.locator("details summary").click();
    const table = page.getByRole("table", { name: caption });
    await expect(table).toBeVisible();
    const first = table.locator("tbody tr").first();
    await expect(first.locator("td").first()).toHaveText(/^\$[\d,]+$/);
    if (path === "/territories")
      await expect(first.locator("td").last()).toHaveText(/^\$[\d,]+$/);
  }
});
test("clean and tracking URLs, recognized malformed filters and empty selections", async ({
  page,
  request,
}) => {
  const clean = await (await request.get("/api/dashboard")).json();
  for (const query of [
    "utm_source=chatgpt.com",
    "utm_source=a&utm_source=b",
    "unexpected=yes",
  ]) {
    const response = await request.get(`/api/dashboard?${query}`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual(clean);
    await page.goto(`/?${query}`);
    await expect(page.getByTestId("sales-kpi")).toHaveText("$953,544");
  }
  const mixed = await (
    await request.get("/api/dashboard?utm_source=x&territory=1&category=3")
  ).json();
  expect(mixed).toEqual(
    await (await request.get("/api/dashboard?territory=1&category=3")).json(),
  );
  for (const query of [
    "start=2014-02-30",
    "start=",
    "territory=999",
    "territory=1&territory=2",
    "category=1,999",
    "territory=1,1",
    "utm_source=x&end=bad",
  ]) {
    await page.goto(`/customers?${query}`);
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    await expect(page.getByTestId("analytics-content")).toHaveCount(0);
    expect((await request.get(`/api/dashboard?${query}`)).status()).toBe(400);
  }
  await page.goto("/?start=2020-01-01&end=2020-12-31");
  await expect(page.getByTestId("sales-kpi")).toHaveText("$0");
});
test("custom date range, validation and clearing individual selections", async ({
  page,
}) => {
  await page.goto("/filters");
  await expect(page.getByLabel("Date preset")).toHaveCount(0);
  await page.getByLabel("Start date").fill("2014-02-01");
  await page.getByLabel("End date").fill("2014-02-28");
  await expect(page.getByLabel("Applied Filters")).not.toContainText(
    "2014-02-01",
  );
  await page
    .getByRole("button", { name: "Apply Filters", exact: true })
    .click();
  await expect(page).toHaveURL(/start=2014-02-01&end=2014-02-28/);
  await expect(page.getByLabel("Applied Filters")).toContainText("2014-02-01");
  await page.getByLabel("Start date").fill("2014-12-31");
  await page.getByLabel("End date").fill("2014-01-01");
  await page
    .getByRole("button", { name: "Apply Filters", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "start on or before the end",
  );
  await expect(page.getByLabel("Applied Filters")).toContainText("2014-02-01");
  await page.getByRole("checkbox", { name: "Northwest", exact: true }).check();
  await page
    .getByRole("checkbox", { name: "Northwest", exact: true })
    .uncheck();
  await expect(
    page.getByRole("checkbox", { name: "All Territories", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Reset Filters", exact: true })
    .click();
  await expect(page.getByLabel("Start date")).toHaveValue("2013-01-01");
  await expect(page.getByLabel("End date")).toHaveValue("2014-12-22");
});
