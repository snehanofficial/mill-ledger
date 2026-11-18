import { expect, test } from "@playwright/test";

test.describe("MillLedger Application Shell", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test for clean initial state
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
  });

  test("desktop 1280px: persistent shell layout, dimensions and brand", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    // Redirects to /dashboard
    await expect(page).toHaveURL(/\/dashboard$/);

    // Header dimensions: exactly 64px sticky
    const header = page.locator("header");
    await expect(header).toBeVisible();
    const headerBox = await header.boundingBox();
    expect(headerBox?.height).toBe(64);

    // Brand and workspace identity
    await expect(page.getByLabel("MillLedger home")).toBeVisible();
    await expect(
      page.getByText("MillLedger", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Production unit").first()).toBeVisible();

    // Sidebar: expanded at 248px
    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar).toBeVisible();
    const sidebarBox = await sidebar.boundingBox();
    expect(Math.round(sidebarBox?.width ?? 0)).toBe(248);

    // Navigation sections & items
    await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Orders" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Stock" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Invoices" })).toBeVisible();

    // Breadcrumb on overview
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toContainText("Overview");

    // Connection indicator
    await expect(page.getByText("Live")).toBeVisible();

    // User menu in footer
    await expect(page.getByText("Factory Admin")).toBeVisible();
  });

  test("sidebar collapse, icon-rail (72px) and persistence without flicker", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard");

    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar).toBeVisible();
    let box = await sidebar.boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(248);

    // Toggle sidebar via trigger button
    const trigger = page.getByRole("button", { name: "Toggle sidebar" });
    await trigger.click();

    // Collapses to 72px icon rail
    await expect(async () => {
      box = await sidebar.boundingBox();
      expect(Math.round(box?.width ?? 0)).toBe(72);
    }).toPass({ timeout: 2000 });

    // Verify localStorage has persisted 'false'
    const persisted = await page.evaluate(() =>
      localStorage.getItem("ml-sidebar-expanded-dev-user-1"),
    );
    expect(persisted).toBe("false");

    // Reload page: should start in collapsed state (72px) with NO first-render flicker
    await page.reload();
    const reloadedSidebar = page.locator('[data-slot="sidebar"]');
    await expect(reloadedSidebar).toBeVisible();
    const reloadedBox = await reloadedSidebar.boundingBox();
    expect(Math.round(reloadedBox?.width ?? 0)).toBe(72);

    // Keyboard shortcut: Ctrl+B expands it back
    await page.keyboard.press("Control+b");
    await expect(async () => {
      const expandedBox = await reloadedSidebar.boundingBox();
      expect(Math.round(expandedBox?.width ?? 0)).toBe(248);
    }).toPass({ timeout: 2000 });
  });

  test("route transitions, active nav states and breadcrumb derivation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard");

    // Direct leaf link: Invoices
    const invoicesLink = page.getByRole("link", { name: "Invoices" });
    await invoicesLink.click();
    await expect(page).toHaveURL(/\/invoices$/);
    await expect(page.locator("h1")).toContainText("Invoices");

    // Breadcrumb updates to "Invoices"
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb).toContainText("Invoices");

    // Collapsible group: expand Orders
    const ordersBtn = page.getByRole("button", { name: "Orders" });
    await ordersBtn.click();
    const allOrdersLink = page.getByRole("link", { name: "All orders" });
    await expect(allOrdersLink).toBeVisible();
    await allOrdersLink.click();
    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.locator("h1")).toContainText("Orders");
    await expect(breadcrumb).toContainText("Orders");

    // Navigate to New Order
    await page.goto("/orders/new");
    await expect(page.locator("h1")).toContainText("New order");

    // Breadcrumbs show: Orders > New order
    await expect(breadcrumb).toContainText("Orders");
    await expect(breadcrumb).toContainText("New order");

    // Breadcrumb link navigation: clicking "Orders" in breadcrumb takes back to /orders
    const crumbOrderLink = breadcrumb.getByRole("link", { name: "Orders" });
    await crumbOrderLink.click();
    await expect(page).toHaveURL(/\/orders$/);
  });

  test("global command search (Ctrl+K and click)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard");

    // Open search via header search button or shortcut
    const searchBtn = page.getByRole("button", { name: "Search (Ctrl+K)" });
    await expect(searchBtn).toBeVisible();
    await searchBtn.click();

    const dialog = page.locator('[data-slot="dialog-content"]');
    await expect(dialog).toBeVisible();

    // Type query "Stock"
    await page.keyboard.type("Stock");
    const stockItem = dialog.getByRole("option", { name: /Stock/i }).first();
    await expect(stockItem).toBeVisible();

    // Click to navigate
    await stockItem.click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/stock$/);
    await expect(page.locator("h1")).toContainText("Stock");
  });

  test("notifications sheet panel", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard");

    const notifBtn = page.getByRole("button", { name: /Notifications/i });
    await notifBtn.click();

    await expect(
      page.getByRole("heading", { name: "Notifications" }),
    ).toBeVisible();
    await expect(page.getByText("No notifications")).toBeVisible();

    // Close with Escape
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: "Notifications" }),
    ).toBeHidden();
  });

  test("tablet/mobile <768px: responsive behavior and mobile drawer", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 767, height: 900 });
    await page.goto("/dashboard");

    // Desktop sidebar is hidden at tablet width
    const desktopSidebar = page.locator('[data-slot="sidebar"]');
    await expect(desktopSidebar).toBeHidden();

    // Mobile menu button is visible in header
    const menuBtn = page.getByRole("button", { name: "Open navigation" });
    await expect(menuBtn).toBeVisible();

    // Click menu button to open drawer
    await menuBtn.click();
    const drawer = page.locator('[data-slot="sidebar"][data-state="open"]');
    await expect(drawer).toBeVisible();

    // Navigate inside drawer closes it
    const stockLink = drawer.getByRole("link", { name: "Stock" });
    await stockLink.click();
    await expect(page).toHaveURL(/\/stock$/);
    await expect(drawer).toBeHidden();
  });

  test("mobile 390px and 320px reflow: zero horizontal overflow", async ({
    page,
  }) => {
    // Test 390px iPhone width
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");

    let overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // Test 320px narrowest reflow
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/dashboard");

    overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("keyboard accessibility: skip-to-main content link and focus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard");

    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await skipLink.focus();
    await expect(skipLink).toBeFocused();

    // Press enter on skip link
    await page.keyboard.press("Enter");
    const main = page.locator("#main-content");
    await expect(main).toBeFocused();
  });

  test("zero Cumulative Layout Shift (CLS)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Inject PerformanceObserver for layout-shift
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as unknown as {
            hadRecentInput?: boolean;
            value?: number;
          };
          if (!shift.hadRecentInput) {
            (window as unknown as { __cls: number }).__cls += shift.value ?? 0;
          }
        }
      });
      observer.observe({ type: "layout-shift", buffered: true });
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Navigate to another page
    await page.getByRole("link", { name: "Stock" }).click();
    await page.waitForURL(/\/stock$/);

    const cls = await page.evaluate(
      () => (window as unknown as { __cls: number }).__cls,
    );
    // CLS should be strictly below 0.05 (ideal target < 0.01)
    expect(cls).toBeLessThan(0.05);
  });

  test("capture verification screenshots", async ({ page }) => {
    // 1. Desktop expanded
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "e2e/screenshots/desktop-expanded.png" });

    // 2. Desktop collapsed icon rail
    await page.getByRole("button", { name: "Toggle sidebar" }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "e2e/screenshots/desktop-collapsed.png" });

    // 2b. Hover over Stock icon to display directed tooltip
    const stockLink = page
      .locator('[data-slot="sidebar"]')
      .getByRole("link", { name: "Stock" });
    await stockLink.hover();
    await page.waitForTimeout(200);
    await page.screenshot({
      path: "e2e/screenshots/desktop-collapsed-tooltip.png",
    });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);

    // 3. Desktop search open
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(200);
    await page.screenshot({ path: "e2e/screenshots/desktop-search.png" });
    await page.keyboard.press("Escape");

    // 4. Desktop notifications open
    await page.getByRole("button", { name: /Notifications/i }).click();
    await page.waitForTimeout(200);
    await page.screenshot({
      path: "e2e/screenshots/desktop-notifications.png",
    });
    await page.keyboard.press("Escape");

    // 5. Tablet view (768px)
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/dashboard");
    await page.screenshot({ path: "e2e/screenshots/tablet-view.png" });

    // 6. Mobile view (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "e2e/screenshots/mobile-view.png" });

    // 7. Mobile drawer open
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "e2e/screenshots/mobile-drawer.png" });
  });
});
