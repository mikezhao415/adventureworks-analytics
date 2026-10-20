import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("URL filters, drafts, navigation, history and reset", async ({
  page,
}, info) => {
  await page.goto("/");
  const sales = page.getByTestId("sales-kpi");
  await expect(sales).toHaveText("953,544");
  await page.getByLabel("Territory", { exact: true }).selectOption("1");
  await expect(sales).toHaveText("953,544");
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/territory=1/);
  await expect(sales).not.toHaveText("953,544");
  const selected = await sales.textContent();
  await page.getByLabel("Product category").selectOption("3");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/category=3/);
  await expect(sales).toHaveText(selected!);
  await page
    .locator("nav")
    .getByRole("link", { name: "Customer insights", exact: true })
    .click();
  await expect(page).toHaveURL(/customers.*territory=1.*category=3/);
  await expect(
    page.getByRole("textbox", { name: "Search customers" }),
  ).toBeVisible();
  await page.goBack();
  await expect(sales).toHaveText(selected!);
  await page.goBack();
  await expect(page.getByLabel("Product category")).toHaveValue("all");
  await page.goForward();
  await expect(page.getByLabel("Product category")).toHaveValue("3");
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(sales).toHaveText("953,544");
  if (process.env.CAPTURE_DASHBOARD_SCREENSHOTS === "1")
    await page.screenshot({
      path: `../../docs/screenshots/sales-dashboard-${info.project.name}.png`,
      scale: "css",
      fullPage: info.project.name === "mobile",
    });
});
test("all pages deep link, expose active navigation and pass accessibility", async ({
  page,
}, info) => {
  for (const path of [
    "/",
    "/trends",
    "/products",
    "/customers",
    "/territories",
    "/definitions",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1:visible")).toBeVisible();
    await expect(page.locator('nav a[aria-current="page"]')).toHaveCount(1);
    await expect(page.locator('nav a[aria-current="page"]')).toHaveAttribute(
      "href",
      path,
    );
    if (path === "/definitions")
      await expect(page.getByLabel("Territory", { exact: true })).toHaveCount(
        0,
      );
    else
      await expect(
        page.getByRole("button", { name: "Apply filters" }),
      ).toBeEnabled();
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
    if (
      path === "/customers" &&
      process.env.CAPTURE_DASHBOARD_SCREENSHOTS === "1"
    )
      await page.screenshot({
        path: `../../docs/screenshots/sales-dashboard-customers-${info.project.name}.png`,
        scale: "css",
        fullPage: info.project.name === "mobile",
      });
  }
  await page.goto("/trends");
  await expect(
    page.getByRole("button", { name: "Apply filters" }),
  ).toBeEnabled();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to page content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.locator("details summary").focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("table", { name: "Exact monthly sales and orders" }),
  ).toBeVisible();
  await page.goto("/customers");
  await page.getByRole("textbox", { name: "Search customers" }).fill("00024");
  await expect(page.getByText("1–1 of 1")).toBeVisible();
  await page
    .getByRole("region", { name: "Customer sales table", exact: true })
    .focus();
  await expect(
    page.getByRole("region", { name: "Customer sales table", exact: true }),
  ).toBeFocused();
});
test("empty selections and invalid URLs fail closed", async ({
  page,
  request,
}) => {
  await page.goto("/?start=2020-01-01&end=2020-12-31");
  await expect(page.getByTestId("sales-kpi")).toHaveText("0");
  await expect(
    page.getByRole("article", { name: "Average order value" }),
  ).toContainText("—");
  for (const query of [
    "start=2014-02-30",
    "territory=999",
    "territory=1&territory=2",
    "unexpected=yes",
  ]) {
    await page.goto(`/customers?${query}`);
    await expect(page.locator(".error-banner")).toBeVisible();
    await expect(page.getByTestId("analytics-content")).toHaveCount(0);
    expect((await request.get(`/api/dashboard?${query}`)).status()).toBe(400);
  }
});
