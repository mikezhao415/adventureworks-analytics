import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

test("fictional packaged lineage supports responsive exploration, history, keyboard and touch", async ({
  page,
  request,
  isMobile,
}) => {
  const errors: string[] = [],
    external: string[] = [],
    failed: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:3100")) external.push(r.url());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(r.url());
  });
  await page.goto("/lineage");
  if (!isMobile) {
    await expect(page.locator(".react-flow__node")).toHaveCount(8);
    await expect(page.locator(".react-flow__edge")).toHaveCount(9);
    await expect
      .poll(() =>
        page.locator(".react-flow__node").evaluateAll((nodes) =>
          nodes.every((node) => {
            const box = node.getBoundingClientRect();
            return [...node.childNodes]
              .filter((child) => child.nodeType === Node.TEXT_NODE)
              .every((child) => {
                const range = document.createRange();
                range.selectNodeContents(child);
                const text = range.getBoundingClientRect();
                return text.left >= box.left - 1 && text.right <= box.right + 1;
              });
          }),
        ),
      )
      .toBe(true);
  }
  await page.screenshot({
    path: `test-results/lineage-${isMobile ? "mobile" : "desktop"}.png`,
  });
  await expect(
    page.getByRole("heading", { name: "mart_sales_summary", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".lineage-details")).toContainText(
    "Fictional contract fixture",
  );
  const tap = async (locator: ReturnType<typeof page.getByRole>) => {
    if (isMobile) await locator.tap();
    else await locator.click();
  };
  if (!isMobile) {
    await tap(page.getByRole("radio", { name: "Upstream", exact: true }));
    await expect(page).toHaveURL(/mode=upstream/);
    expect(await page.locator(".lineage-subdued").count()).toBe(0);
    const node = page.locator(
      '.react-flow__node[data-id="model.adventureworks.fct_sales_orders"]',
    );
    await node.scrollIntoViewIfNeeded();
    if (isMobile) await node.tap();
    else await node.click();
    await expect(
      page.getByRole("heading", { name: "fct_sales_orders", exact: true }),
    ).toBeVisible();
    await tap(page.getByRole("radio", { name: "Downstream", exact: true }));
    await expect(page.locator(".lineage-subdued")).toHaveCount(5);
    await expect(page).toHaveURL(/mode=downstream/);
    const url = page.url();
    await tap(page.getByRole("button", { name: "Zoom in", exact: true }));
    await tap(
      page.getByRole("button", { name: "Fit/reset graph view", exact: true }),
    );
    await expect(page).toHaveURL(url);
    const viewport = page.locator(".react-flow__viewport");
    const before = await viewport.getAttribute("style");
    const canvas = page.locator(".lineage-canvas");
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    if (isMobile) {
      const session = await page.context().newCDPSession(page);
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height - 90 }],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: box.x + box.width / 2 + 50, y: box.y + box.height - 60 },
        ],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } else {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height - 90);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width / 2 + 50,
        box.y + box.height - 60,
        {
          steps: 5,
        },
      );
      await page.mouse.up();
    }
    await expect(viewport).not.toHaveAttribute("style", before!);
  } else {
    await expect(page.locator(".lineage-canvas")).toHaveCount(0);
    await page
      .getByRole("combobox")
      .selectOption("model.adventureworks.fct_sales_orders");
  }
  const choice = isMobile
    ? page.getByRole("combobox")
    : page.getByRole("button", {
        name: /^stg_sales_order_header model/,
      });
  if (isMobile)
    await choice.selectOption("model.adventureworks.stg_sales_order_header");
  else {
    await choice.focus();
    await page.keyboard.press("Enter");
  }
  await expect(
    page.getByRole("heading", { name: "stg_sales_order_header", exact: true }),
  ).toBeVisible();
  if (!isMobile) await expect(choice).toBeFocused();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "stg_sales_order_header", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "fct_sales_orders", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "stg_sales_order_header", exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/lineage?node=unknown&mode=invalid");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "unsupported lineage parameters" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "mart_sales_summary", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  expect(failed).toEqual([]);
  const tracePath = path.resolve(".next/server/app/lineage/page.js.nft.json");
  const trace = JSON.parse(await readFile(tracePath, "utf8"));
  expect(
    trace.files.map((f: string) => path.resolve(path.dirname(tracePath), f)),
  ).toContain(path.resolve("data/lineage/sales.json"));
  expect((await request.get("/data/lineage/sales.json")).status()).toBe(404);
  const html = await (await request.get("/lineage")).text();
  const rsc = await (
    await request.get("/lineage", { headers: { RSC: "1" } })
  ).text();
  for (const content of [html, rsc])
    expect(content).not.toMatch(
      /PRIVATE_LINEAGE_SQL_CANARY|raw_code|compiled_code|dbt_schema_version|MANIFEST.JSON INLINE DATA/,
    );
  expect(
    trace.files.map((f: string) => path.resolve(path.dirname(tracePath), f)),
  ).not.toContain(path.resolve("data/private-manifest.json"));
});

test("measure actual route JavaScript and verify deferred graph loading", async ({
  browser,
  isMobile,
}, testInfo) => {
  async function measure(route: string) {
    const page = await browser.newPage();
    const assets: Record<string, { bytes: number; gzip: number }> = {};
    const pending: Promise<void>[] = [];
    page.on("response", (response) => {
      if (
        response.url().includes("/_next/static/") &&
        response.url().split("?")[0].endsWith(".js")
      )
        pending.push(
          (async () => {
            const raw = await response.body();
            assets[new URL(response.url()).pathname] = {
              bytes: raw.length,
              gzip: gzipSync(raw).length,
            };
          })(),
        );
    });
    await page.goto("http://127.0.0.1:3100" + route);
    if (route === "/lineage") {
      if (isMobile) {
        await expect(page.getByRole("combobox")).toBeVisible();
        await expect(page.locator(".lineage-canvas")).toHaveCount(0);
      } else await expect(page.locator(".react-flow__node")).toHaveCount(8);
    } else await expect(page.locator(".kpi")).toHaveCount(4);
    await page.waitForLoadState("networkidle");
    await Promise.all(pending);
    await page.close();
    return assets;
  }
  const overview = await measure("/"),
    lineage = await measure("/lineage");
  const additional = Object.entries(lineage).filter(
    ([name]) => !overview[name],
  );
  expect(additional.length).toBeGreaterThan(0);
  await mkdir("test-results", { recursive: true });
  await writeFile(
    `test-results/lineage-bundle-${testInfo.project.name}.json`,
    JSON.stringify(
      {
        scope:
          "Fictional isolated production build; decoded minified JS bytes and per-file gzip, not HTTP transfer timing",
        overview,
        lineage,
        additional_lineage_bytes: additional.reduce(
          (sum, [, v]) => sum + v.bytes,
          0,
        ),
        additional_lineage_gzip: additional.reduce(
          (sum, [, v]) => sum + v.gzip,
          0,
        ),
      },
      null,
      2,
    ) + "\n",
  );
});

test("graph loading failure retains the complete accessible explorer", async ({
  page,
  isMobile,
}) => {
  let blocked = false;
  await page.route("**/_next/static/chunks/*.js", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (
      body.includes("lineage-edge-active") &&
      body.includes("nodesDraggable")
    ) {
      blocked = true;
      await route.abort();
    } else await route.fulfill({ response });
  });
  await page.goto("/lineage");
  if (isMobile) {
    await expect(page.getByRole("combobox")).toBeVisible();
    await expect(page.locator(".lineage-canvas")).toHaveCount(0);
    expect(blocked).toBe(false);
    return;
  }
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "interactive graph is unavailable" }),
  ).toBeVisible();
  expect(blocked).toBe(true);
  await expect(page.locator(".lineage-node-list button")).toHaveCount(8);
  await page.locator(".lineage-node-list button").first().focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "dim_date", exact: true }),
  ).toBeVisible();
});
