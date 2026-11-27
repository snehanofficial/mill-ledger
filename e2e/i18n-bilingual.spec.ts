import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "laptop-1024", width: 1024, height: 768 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-360", width: 360, height: 800 },
];

test.describe("System-Wide Tamil & English (i18n) Verification", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/auth/login");
    await page.evaluate(() => window.localStorage.clear());
  });

  test("switches language immediately without reload, preserves form state, and persists across reload & auth", async ({
    page,
  }) => {
    await page.goto("/auth/login");
    await expect(page.locator("html")).toHaveAttribute("lang", /^en/);

    // Fill unsaved form values before switching language
    await page.locator("input#email").fill("admin@millledger.local");
    await page.locator("input#password").fill("AdminPassword123!");

    // Switch to Tamil via segmented LanguageSelector
    await page.getByRole("button", { name: "தமிழ்" }).click();

    // Verify immediate DOM update without reload & preserved form inputs
    await expect(page.locator("html")).toHaveAttribute("lang", "ta-IN");
    await expect(
      page.getByRole("heading", { name: "ஆலை ஏடு உள்நுழைவு" }),
    ).toBeVisible();
    await expect(page.locator("input#email")).toHaveValue(
      "admin@millledger.local",
    );
    await expect(page.locator("input#password")).toHaveValue(
      "AdminPassword123!",
    );

    // Reload and verify localStorage persistence
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "ta-IN");
    await expect(
      page.getByRole("heading", { name: "ஆலை ஏடு உள்நுழைவு" }),
    ).toBeVisible();

    // Sign in and then switch to Tamil so user-level preference persists in DB
    await page.locator("input#email").fill("admin@millledger.local");
    await page.locator("input#password").fill("AdminPassword123!");
    await page.getByRole("button", { name: "உள்நுழைக" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);

    // Switch to Tamil via authenticated header LanguageSelector
    await page
      .getByRole("button", { name: /English|தமிழ்/i })
      .first()
      .click();
    await page.getByRole("menuitemradio", { name: "தமிழ்" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ta-IN");

    // Reload and verify DB-persisted Tamil preference is restored
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "ta-IN");

    // Navigate to orders, invoices, dispatch, receivables, settings
    for (const route of [
      "/orders",
      "/invoices",
      "/dispatch",
      "/receivables",
      "/reports",
      "/settings",
    ]) {
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("lang", "ta-IN");
      const hasOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(hasOverflow, `Horizontal overflow on ${route} in ta-IN`).toBe(
        false,
      );
    }

    // Switch back to English via header LanguageSelector
    await page
      .getByRole("button", { name: /தமிழ்|English/i })
      .first()
      .click();
    await page.getByRole("menuitemradio", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en-IN");

    // Reload and verify persisted preference from user profile
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en-IN");
  });

  for (const vp of VIEWPORTS) {
    test(`no horizontal overflow in ta-IN and en-IN at ${vp.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");

      // Check English
      await expect(page.locator("html")).toHaveAttribute("lang", /^en/);
      const enOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(enOverflow, `Overflow on / in en-IN at ${vp.name}`).toBe(false);

      // Switch to Tamil
      await page
        .getByRole("button", { name: /English|தமிழ்/i })
        .first()
        .click();
      await page.getByRole("menuitemradio", { name: "தமிழ்" }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "ta-IN");

      const taOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(taOverflow, `Overflow on / in ta-IN at ${vp.name}`).toBe(false);
    });
  }
});
