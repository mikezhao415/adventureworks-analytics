import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PAGES } from "../lib/navigation";

test("shared favicon is exact, decodes, and is declared on every page", async ({
  page,
  request,
}) => {
  const source = await readFile("app/icon.svg");
  expect(
    createHash("sha1")
      .update(Buffer.concat([Buffer.from(`blob ${source.length}\0`), source]))
      .digest("hex"),
  ).toBe("1e36049d2711780b1d69e8ca59313ba830d35ed5");
  for (const item of PAGES) {
    await page.goto(item.path);
    const icon = page.locator('link[rel="icon"]');
    await expect(icon).toHaveCount(1);
    await expect(icon).toHaveAttribute("type", "image/svg+xml");
    const href = await icon.getAttribute("href");
    expect(href).toMatch(/^\/icon\.svg/);
    const response = await request.get(href!);
    expect(response.ok()).toBe(true);
    expect(await response.body()).toEqual(source);
    expect(
      await page.evaluate(async (url) => {
        const image = new Image();
        image.src = url!;
        await image.decode();
        return image.naturalWidth > 0 && image.naturalHeight > 0;
      }, href),
    ).toBe(true);
  }
});

for (const [width, columns] of [
  [320, 1],
  [375, 1],
  [768, 2],
  [1440, 4],
]) {
  test(`overview KPIs at ${width}px use ${columns} columns without clipping`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto("/");
    const cards = page.locator(".kpi");
    await expect(cards).toHaveCount(4);
    await expect(cards.first()).toBeVisible();
    const boxes = await cards.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }),
    );
    expect(new Set(boxes.map((box) => box.x)).size).toBe(columns);
    for (let index = columns; index < boxes.length; index++) {
      expect(boxes[index].y).toBeGreaterThanOrEqual(
        boxes[index - columns].y + boxes[index - columns].height,
      );
    }
    for (const text of await page
      .locator(".kpi-label, .kpi-value, .kpi-detail")
      .all()) {
      await expect(text).toBeVisible();
      expect(
        await text.evaluate((element) => {
          const textBox = element.getBoundingClientRect();
          const card = element.closest(".kpi")!.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(element);
          const content = range.getBoundingClientRect();
          return (
            element.scrollWidth <= element.clientWidth &&
            textBox.left >= card.left &&
            textBox.right <= card.right &&
            content.left >= card.left &&
            content.right <= card.right &&
            content.bottom <= card.bottom
          );
        }),
      ).toBe(true);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/overview-${width}-${test.info().project.name}.png`,
      fullPage: true,
    });
  });
}
