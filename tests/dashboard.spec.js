// @ts-check
const { test, expect } = require("@playwright/test");

const ADMIN = { email: "admin@odigo-test.com", password: "OdigoTest2026!" };
const VIEWER = { email: "viewer@odigo-test.com", password: "OdigoTest2026!" };

async function login(page, user) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/", { timeout: 15_000 });
}

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
  });

  test("renders all four stat cards", async ({ page }) => {
    await expect(page.getByText("Active projects")).toBeVisible();
    await expect(page.getByText("Open pipeline")).toBeVisible();
    await expect(page.getByText("Total value")).toBeVisible();
    // Use exact label — avoids matching "Closing in the next 30 days" section
    await expect(page.getByText("Closing ≤ 30d")).toBeVisible();
  });

  test("pipeline value chart SVG is rendered", async ({ page }) => {
    await expect(page.locator("svg.recharts-surface").first()).toBeVisible({ timeout: 8_000 });
  });

  test("closing-in-30-days section exists", async ({ page }) => {
    await expect(page.getByText("Closing in the next 30 days")).toBeVisible();
  });

  test("recent activity feed section is visible", async ({ page }) => {
    await expect(page.getByText("Recent activity")).toBeVisible();
  });

  test("admin dashboard shows personalised greeting", async ({ page }) => {
    await expect(page.getByText(/Good (morning|afternoon|evening), Eddie/i)).toBeVisible();
  });

  test("viewer dashboard shows personalised greeting", async ({ page }) => {
    // Clear the ADMIN session from beforeEach before logging in as viewer
    await page.context().clearCookies();
    await login(page, VIEWER);
    await expect(page.getByText(/Good (morning|afternoon|evening), Sam/i)).toBeVisible();
  });

  test("open pipeline stat card shows a dollar amount", async ({ page }) => {
    const card = page.getByText("Open pipeline").locator("..").locator("..");
    await expect(card).toContainText("$");
  });

  test("total value stat card shows a dollar amount", async ({ page }) => {
    const card = page.getByText("Total value").locator("..").locator("..");
    await expect(card).toContainText("$");
  });
});
