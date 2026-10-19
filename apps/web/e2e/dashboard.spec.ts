import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("overview, supported filter, scope, reset and search", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sales overview", exact: true }),
  ).toBeVisible();
  const sales = page.getByTestId("sales-kpi");
  await expect(sales).toHaveText("953,544.31");
  for (const id of [
    "trends",
    "categories",
    "products",
    "customers",
    "territories",
  ])
    await expect(page.locator(`#${id}`)).toBeAttached();
  await page.getByLabel("Territory", { exact: true }).selectOption("1");
  await page.getByLabel("Start date").fill("2014-01-01");
  await page.getByLabel("End date").fill("2014-12-31");
  const filtered = page.waitForResponse(
    (r) => r.url().includes("/api/dashboard") && r.status() === 200,
  );
  await page.getByRole("button", { name: "Apply filters" }).click();
  const response = await (await filtered).json();
  await expect(
    page.getByRole("article", { name: "Orders", exact: true }),
  ).toContainText(String(response.summary.order_count));
  await expect(sales).not.toHaveText("953,544.31");
  const before = await sales.textContent();
  await page.getByLabel("Product category").selectOption("3");
  const category = page.waitForResponse(
    (r) => r.url().includes("/api/dashboard") && r.status() === 200,
  );
  await page.getByRole("button", { name: "Apply filters" }).click();
  await category;
  await expect(
    page.getByText("Clothing · products & categories only"),
  ).toBeVisible();
  await expect(sales).toHaveText(before!);
  await expect(page.getByRole("table", { name: "Top products" })).toContainText(
    "jersey",
  );
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(sales).toHaveText("953,544.31");
  await page.getByRole("textbox", { name: "Search customers" }).fill("00024");
  await expect(page.getByText("1–1 of 1")).toBeVisible();
  await page.getByRole("textbox", { name: "Search customers" }).fill("");
  await page.locator("#methodology summary").click();
  await expect(page.getByText("dashboard-fixture-v1")).toBeVisible();
  await page.locator("#methodology summary").click();
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  if (process.env.CAPTURE_DASHBOARD_SCREENSHOTS === "1")
    await page.screenshot({
      path: `../../docs/screenshots/sales-dashboard-${testInfo.project.name}.png`,
      fullPage: false,
      scale: "css",
    });
});

test("keyboard entry, exact chart alternatives and accessibility", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Apply filters" }),
  ).toBeEnabled();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to sales overview" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.locator("#trends summary").focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("table", { name: "Exact monthly sales and orders" }),
  ).toBeVisible();
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    scan.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});

test("empty results and rejected filters", async ({ page, request }) => {
  await page.goto("/");
  await page.getByLabel("Start date").fill("2020-01-01");
  await page.getByLabel("End date").fill("2020-12-31");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByTestId("sales-kpi")).toHaveText("0.00");
  await expect(
    page.getByRole("article", { name: "Average order value" }),
  ).toContainText("—");
  expect((await request.get("/api/dashboard?start=2014-02-30")).status()).toBe(
    400,
  );
  expect((await request.get("/api/dashboard?territory=999")).status()).toBe(
    400,
  );
  expect(
    (await request.get("/api/dashboard?territory=1&territory=2")).status(),
  ).toBe(400);
});
