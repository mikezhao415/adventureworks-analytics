import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { validateApprovedLineage } from "../lib/lineage-validation.mjs";

const pin = JSON.parse(readFileSync("data/lineage/approval.json", "utf8"));
const raw = pin.publication_approved
  ? readFileSync("data/lineage/sales.json")
  : null;
const doc = raw ? validateApprovedLineage(raw, pin) : null;
const target = "model.adventureworks.mart_sales_summary";

test("responsive presentation avoids mobile canvas mounts and aligns desktop panels", async ({
  page,
  isMobile,
}) => {
  if (!doc) return;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.addInitScript(() => {
    const state = window as typeof window & { lineageCanvasMounts: number };
    state.lineageCanvasMounts = 0;
    new MutationObserver((records) => {
      for (const record of records)
        for (const added of record.addedNodes) {
          if (
            added instanceof Element &&
            (added.matches(".lineage-canvas") ||
              added.querySelector(".lineage-canvas"))
          )
            state.lineageCanvasMounts++;
        }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/lineage");
  if (isMobile) {
    await expect(
      page.getByRole("combobox", { name: "Explore lineage nodes" }),
    ).toHaveValue(target);
    await page
      .getByRole("combobox")
      .selectOption("model.adventureworks.fct_sales_orders");
    await expect(
      page.getByRole("heading", { name: "fct_sales_orders", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { lineageCanvasMounts: number })
            .lineageCanvasMounts,
      ),
    ).toBe(0);
    await page.goto("/lineage");
  } else {
    await expect(page.locator(".react-flow__node")).toHaveCount(8);
  }
  await page.screenshot({
    path: `test-results/polished-lineage-${isMobile ? "mobile" : "desktop"}.png`,
    fullPage: true,
  });
  if (!isMobile) {
    for (const width of [901, 1100, 1440]) {
      await page.setViewportSize({ width, height: 1080 });
      await expect(page.locator(".react-flow__node")).toHaveCount(8);
      const graph = (await page.locator(".lineage-canvas").boundingBox())!;
      const details = (await page.locator(".lineage-details").boundingBox())!;
      const explore = (await page.locator(".lineage-explore").boundingBox())!;
      const layout = (await page.locator(".lineage-layout").boundingBox())!;
      const modes = (await page.locator(".lineage-modes").boundingBox())!;
      const helper = (await page
        .locator("#lineage-instructions")
        .boundingBox())!;
      const announcement = (await page
        .locator(".lineage-announcement")
        .boundingBox())!;
      expect(Math.abs(explore.y - details.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(explore.width - details.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(graph.width - layout.width)).toBeLessThanOrEqual(1);
      expect(graph.y + graph.height).toBeLessThanOrEqual(announcement.y);
      expect(announcement.y + announcement.height).toBeLessThanOrEqual(
        helper.y,
      );
      expect(helper.y + helper.height).toBeLessThanOrEqual(modes.y);
      await expect(
        page.getByRole("link", { name: "Skip to selected node details" }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.getByRole("radio", { name: "Downstream", exact: true }).click();
    await page.setViewportSize({ width: 900, height: 1080 });
    await expect(
      page.locator(".lineage-canvas, .lineage-modes, .lineage-node-list"),
    ).toHaveCount(0);
    await page
      .getByRole("combobox")
      .selectOption("model.adventureworks.fct_sales_orders");
    await expect(page).toHaveURL(/mode=downstream/);
    await page.setViewportSize({ width: 901, height: 1080 });
    await expect(page.locator(".react-flow__node")).toHaveCount(8);
    await expect(
      page.getByRole("radio", { name: "Downstream", exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole("heading", { name: "fct_sales_orders", exact: true }),
    ).toBeVisible();
  } else {
    for (const width of [320, 412, 900]) {
      await page.setViewportSize({ width, height: 915 });
      await expect(page.getByRole("combobox")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
});

test("lineage enforces workspace approval and keeps its raw artifact private", async ({
  page,
  request,
  isMobile,
}) => {
  await page.goto("/lineage");
  await expect(
    page.getByRole("heading", { name: "Data lineage", exact: true }),
  ).toBeVisible();
  if (!doc) {
    await expect(
      page.getByRole("alert").filter({ hasText: "Lineage metadata" }),
    ).toContainText("no valid, explicitly approved artifact");
    await expect(page.locator(".react-flow")).toHaveCount(0);
  } else {
    expect(raw!.length).toBe(30171);
    expect(createHash("sha256").update(raw!).digest("hex")).toBe(
      "02f767c2dcceed082425cf86ba5740861f30f0230d92607eed9dd37f16ade9e7",
    );
    expect(doc.content_sha256).toBe(
      "d5dfc6f729e878df3ba65d126a9ccd4ae7538aa32919284e6e939e24490dca47",
    );
    await expect(page.locator(".react-flow__node")).toHaveCount(
      isMobile ? 0 : 8,
    );
    await expect(page.locator(".react-flow__edge")).toHaveCount(
      isMobile ? 0 : 9,
    );
    await expect(
      page.getByRole("heading", { name: "mart_sales_summary", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".lineage-details")).toContainText(
      "One row for all eligible sales.",
    );
    const tracePath = path.resolve(".next/server/app/lineage/page.js.nft.json");
    const trace = JSON.parse(readFileSync(tracePath, "utf8"));
    expect(
      trace.files.map((f: string) => path.resolve(path.dirname(tracePath), f)),
    ).toContain(path.resolve("data/lineage/sales.json"));
  }
  for (const url of [
    "/dbt/sales/index.html",
    "/dbt/sales/mobile.css",
    "/manifest.json",
    "/catalog.json",
    "/data/lineage/sales.json",
    "/lineage.json",
  ])
    expect((await request.get(url)).status()).toBe(404);
  expect(await (await request.get("/lineage")).text()).not.toContain(
    "MANIFEST.JSON INLINE DATA",
  );
});

test("real reviewed lineage supports responsive selection, history and fixed desktop graph", async ({
  page,
  isMobile,
}) => {
  await page.goto("/lineage");
  if (!doc) {
    await expect(
      page.getByRole("alert").filter({ hasText: "Lineage metadata" }),
    ).toBeVisible();
    return;
  }
  const errors: string[] = [],
    external: string[] = [],
    failures: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).origin !== "http://127.0.0.1:3100")
      external.push(r.url());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) failures.push(r.url());
  });
  if (isMobile) {
    const chooser = page.getByRole("combobox", {
      name: "Explore lineage nodes",
    });
    await expect(chooser.locator("option")).toHaveCount(8);
    await expect(chooser).toHaveValue(target);
    await expect(
      page.locator(".lineage-canvas, .lineage-node-list, .lineage-modes"),
    ).toHaveCount(0);
    await expect(page.getByText("Skip to selected node details")).toHaveCount(
      0,
    );
    await expect(
      page.getByText(/interactive graph is unavailable/),
    ).toHaveCount(0);
    await chooser.selectOption("model.adventureworks.fct_sales_orders");
    await expect(
      page.getByRole("heading", { name: "fct_sales_orders", exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/node=model.adventureworks.fct_sales_orders/);
    await expect(chooser).toHaveValue("model.adventureworks.fct_sales_orders");
    await chooser.focus();
    await page.keyboard.press("Home");
    const firstNode = doc.nodes[0].id;
    await expect(chooser).toHaveValue(firstNode);
    await expect(page).toHaveURL(
      (url) => url.searchParams.get("node") === firstNode,
    );
    await page.keyboard.press("ArrowDown");
    const keyboardNode = doc.nodes[1].id;
    await expect(chooser).toHaveValue(keyboardNode);
    await expect(page).toHaveURL(
      (url) => url.searchParams.get("node") === keyboardNode,
    );
    await expect(chooser).toBeFocused();
    await chooser.selectOption("model.adventureworks.stg_sales_order_header");
    await expect(page).toHaveURL(
      /node=model.adventureworks.stg_sales_order_header/,
    );
    await expect(
      page.getByRole("heading", {
        name: "stg_sales_order_header",
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(chooser).toHaveValue(
      "model.adventureworks.stg_sales_order_header",
    );
    await page.goBack();
    await expect(chooser).toHaveValue(keyboardNode);
    await page.goForward();
    await expect(chooser).toHaveValue(
      "model.adventureworks.stg_sales_order_header",
    );
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    expect(failures).toEqual([]);
    return;
  }
  const activate = async (locator: ReturnType<typeof page.getByRole>) => {
    if (isMobile) await locator.tap();
    else await locator.click();
  };
  await expect(
    page.getByRole("radio", { name: "All", exact: true }),
  ).toBeChecked();
  await page.getByRole("radio", { name: "All", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "Upstream", exact: true }),
  ).toBeChecked();
  await expect(page).toHaveURL(/mode=upstream/);
  await expect(page.locator(".lineage-subdued")).toHaveCount(0);
  const graphNode = page.locator(
    '.react-flow__node[data-id="model.adventureworks.fct_sales_orders"]',
  );
  if (isMobile) await graphNode.tap();
  else await graphNode.click();
  await expect(
    page.getByRole("heading", { name: "fct_sales_orders", exact: true }),
  ).toBeVisible();
  await activate(page.getByRole("radio", { name: "Downstream", exact: true }));
  await expect(page).toHaveURL(/mode=downstream/);
  await expect(page.locator(".lineage-subdued")).toHaveCount(5);
  const url = page.url();
  await activate(page.getByRole("button", { name: "Zoom in", exact: true }));
  await activate(page.getByRole("button", { name: "Zoom out", exact: true }));
  await activate(
    page.getByRole("button", { name: "Fit/reset graph view", exact: true }),
  );
  await expect(page).toHaveURL(url);
  const canvas = page.locator(".lineage-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const viewport = page.locator(".react-flow__viewport"),
    before = await viewport.getAttribute("style");
  if (isMobile) {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height - 85 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: box.x + box.width / 2 + 45, y: box.y + box.height - 55 },
      ],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } else {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 85);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height - 55, {
      steps: 5,
    });
    await page.mouse.up();
  }
  await expect(viewport).not.toHaveAttribute("style", before!);
  await page
    .getByRole("button", { name: "Fit/reset graph view", exact: true })
    .click();
  const position = await graphNode.getAttribute("style");
  const nbox = (await graphNode.boundingBox())!;
  if (isMobile) {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: nbox.x + nbox.width / 2, y: nbox.y + nbox.height / 2 },
      ],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: nbox.x + nbox.width / 2 + 25, y: nbox.y + nbox.height / 2 + 20 },
      ],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } else {
    await page.mouse.move(nbox.x + nbox.width / 2, nbox.y + nbox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      nbox.x + nbox.width / 2 + 25,
      nbox.y + nbox.height / 2 + 20,
      { steps: 5 },
    );
    await page.mouse.up();
  }
  await expect(graphNode).toHaveAttribute("style", position!);
  await graphNode.focus();
  await page.keyboard.press("Delete");
  await expect(page.locator(".react-flow__node")).toHaveCount(8);
  await expect(page.locator(".react-flow__edge")).toHaveCount(9);
  await expect(page.locator(".react-flow__handle.connectable")).toHaveCount(0);
  const choice = page.getByRole("button", {
    name: /^stg_sales_order_header model/,
  });
  await choice.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "stg_sales_order_header", exact: true }),
  ).toBeVisible();
  await expect(choice).toBeFocused();
  await expect(page).toHaveURL(
    /node=model.adventureworks.stg_sales_order_header/,
  );
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
  await activate(page.getByRole("radio", { name: "All", exact: true }));
  await expect(page.locator(".lineage-subdued")).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  expect(failures).toEqual([]);
});

test("real metadata exposes all reviewed details and qualified definitions safely", async ({
  page,
  isMobile,
}) => {
  await page.goto("/lineage");
  if (!doc) {
    await expect(
      page.getByRole("alert").filter({ hasText: "Lineage metadata" }),
    ).toBeVisible();
    return;
  }
  let columns = 0,
    attachments = 0;
  const unique = new Set<string>();
  const details = page.locator("#lineage-details");
  for (const n of doc.nodes) {
    if (isMobile) {
      await page
        .getByRole("combobox", { name: "Explore lineage nodes" })
        .selectOption(n.id);
    } else {
      const choice = page.getByRole("button", {
        name: new RegExp("^" + n.name + " " + n.kind + "(?: |$)"),
      });
      await choice.focus();
      await page.keyboard.press("Enter");
    }
    await expect(
      details.getByRole("heading", { name: n.name, exact: true }),
    ).toBeVisible();
    await expect(details).toContainText(
      n.description || "No description provided",
    );
    if (n.materialization)
      await expect(details).toContainText(n.materialization);
    await expect(details.locator("tbody tr")).toHaveCount(n.columns.length);
    for (let i = 0; i < n.columns.length; i++) {
      const row = details.locator("tbody tr").nth(i),
        c = n.columns[i];
      await expect(row).toContainText(c.name);
      await expect(row).toContainText(c.type);
      await expect(row).toContainText(
        c.description || "No description provided",
      );
    }
    await expect(details.locator(".lineage-tests > li")).toHaveCount(
      n.tests.length,
    );
    await expect(details).toContainText(
      "not current execution results or passing statuses",
    );
    for (let i = 0; i < n.tests.length; i++) {
      const t = n.tests[i],
        item = details.locator(".lineage-tests details").nth(i);
      const trigger = item.locator("summary");
      await expect(trigger).toContainText(t.definition);
      await expect(trigger).not.toContainText("Definition scope and arguments");
      if ((await item.getAttribute("open")) !== null) await trigger.click();
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(item).toHaveAttribute("open", "");
      await expect(item.getByText(t.scope, { exact: true })).toBeVisible();
      await expect(item.getByText(t.id, { exact: true })).toBeVisible();
      if (!Object.keys(t.arguments).length)
        await expect(
          item.getByText("No arguments declared.", { exact: true }),
        ).toBeVisible();
      await page.keyboard.press("Space");
      await expect(item).not.toHaveAttribute("open");
    }
    const broader = n.tests.find((t) => t.scope.startsWith("May also"));
    if (broader) {
      const disclosure = details
        .locator("details")
        .filter({ has: page.getByText(broader.id, { exact: true }) });
      if ((await disclosure.getAttribute("open")) === null) {
        if (isMobile) await disclosure.locator("summary").tap();
        else await disclosure.locator("summary").click();
      }
      await expect(
        disclosure.getByText(broader.scope, { exact: true }),
      ).toBeVisible();
    }
    columns += n.columns.length;
    attachments += n.tests.length;
    n.tests.forEach((t) => unique.add(t.id));
  }
  expect(columns).toBe(88);
  expect(attachments).toBe(54);
  expect(unique.size).toBe(36);
  const source = doc.nodes.find((n) => n.kind === "source")!;
  if (isMobile) {
    await page
      .getByRole("combobox", { name: "Explore lineage nodes" })
      .selectOption(source.id);
  } else {
    await page
      .getByRole("button", {
        name: new RegExp("^" + source.name + " source(?: |$)"),
      })
      .click();
  }
  await expect(
    details.getByRole("heading", { name: source.name, exact: true }),
  ).toBeVisible();
  await expect(
    details.getByText("No description provided", { exact: true }),
  ).toHaveCount(source.columns.length);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/real-lineage-${isMobile ? "mobile" : "desktop"}.png`,
    fullPage: false,
  });
});
