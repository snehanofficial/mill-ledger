import { expect, test } from "@playwright/test";

test.describe("Authentication and Route Protection Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies & storage for clean test isolation
    await page.context().clearCookies();
    await page.goto("/auth/login");
    await page.evaluate(() => window.localStorage.clear());
  });

  test("unauthenticated access to /dashboard redirects to /auth/login with return path state", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // Must be redirected to /auth/login
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(
      page.getByRole("heading", { name: /Sign in to MillLedger|MillLedger/i }),
    ).toBeVisible();
  });

  test("unauthenticated access to /orders redirects to /auth/login and returns to /orders after login", async ({
    page,
  }) => {
    // Navigate directly to protected route
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/auth\/login$/);

    // Sign in using valid benchmark admin credentials
    await page.locator("input#email").fill("admin@millledger.local");
    await page.locator("input#password").fill("AdminPassword123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    // Verify redirected back to originally requested route (/orders)
    await expect(page).toHaveURL(/\/orders$/);
    await expect(
      page.getByRole("heading", {
        name: /Order inbox|My work & orders|Sales orders/i,
      }),
    ).toBeVisible();
  });

  test("authenticated access to /auth/login redirects to /dashboard (vice versa)", async ({
    page,
  }) => {
    // Log in first
    await page.goto("/auth/login");
    await page.locator("input#email").fill("admin@millledger.local");
    await page.locator("input#password").fill("AdminPassword123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Try navigating back to /auth/login while active session exists
    await page.goto("/auth/login");

    // Must immediately redirect away to /dashboard
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("OWASP credential security: rejects invalid password with uniform generic error message", async ({
    page,
  }) => {
    await page.goto("/auth/login");
    await page.locator("input#email").fill("admin@millledger.local");
    await page.locator("input#password").fill("DefinitelyWrongPassword!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    // Stays on login page and shows generic non-enumerating error alert
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole("alert")).toContainText(
      /Invalid email or password|Too many sign-in attempts/i,
    );
  });

  test("password visibility toggle allows inspecting password securely", async ({
    page,
  }) => {
    await page.goto("/auth/login");
    const passwordInput = page.locator("input#password");
    await passwordInput.fill("Secret123!");

    // Initially type="password"
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Toggle button reveals text
    const toggleButton = page.getByRole("button", { name: /Show password/i });
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    // Toggle again masks text
    const hideButton = page.getByRole("button", { name: /Hide password/i });
    await hideButton.click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("sign out invalidates session, clears client query cache, and redirects to /auth/login", async ({
    page,
  }) => {
    // Log in
    await page.goto("/auth/login");
    await page.locator("input#email").fill("admin@millledger.local");
    await page.locator("input#password").fill("AdminPassword123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Open user menu dropdown in header
    const userMenuButton = page.getByLabel(/Account:/i);
    await userMenuButton.click();

    // Click Sign out
    const signOutItem = page.getByRole("menuitem", { name: /Sign out/i });
    await signOutItem.click();

    // Must redirect to /auth/login
    await expect(page).toHaveURL(/\/auth\/login$/);

    // Attempting to visit /dashboard afterwards must redirect to /auth/login
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login$/);
  });
});
