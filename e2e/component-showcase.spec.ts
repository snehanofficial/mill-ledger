import { expect, test } from "@playwright/test";

test("shows the routed component inventory", async ({ page }) => {
  await page.goto("/showcase");

  await expect(
    page.getByRole("heading", { name: "Component inventory" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Actions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Forms" })).toBeVisible();
});

test("command menu opens and closes with Escape", async ({ page }) => {
  await page.goto("/showcase");

  await page.getByRole("button", { name: "Open command menu" }).click();
  await expect(
    page.getByRole("dialog", { name: "Command menu" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Command menu" })).toBeHidden();
});

test("confirmation dialog traps the consequential action", async ({ page }) => {
  await page.goto("/showcase");

  await page.getByRole("button", { name: "Void record" }).click();
  await expect(
    page.getByRole("alertdialog", { name: "Void this record?" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.getByRole("alertdialog", { name: "Void this record?" }),
  ).toBeHidden();
});

test("shows feedback toast and reflows at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/showcase");

  await page.getByRole("button", { name: "Success toast" }).click();
  await expect(page.getByText("Changes saved")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
