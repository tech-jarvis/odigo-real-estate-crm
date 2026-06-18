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

async function openFirstProject(page) {
  await page.goto("/pipeline");
  await page.locator("a[href^='/pipeline/']").first().click();
  await page.waitForURL(/\/pipeline\/.+/);
}

const PLACEHOLDER = "Add a note, call summary, or status update…";

test.describe("Activity Log", () => {
  test("activity log section shows Append-only badge", async ({ page }) => {
    await login(page, ADMIN);
    await openFirstProject(page);
    await expect(page.getByText("Append-only")).toBeVisible();
  });

  test("admin sees the activity entry form", async ({ page }) => {
    await login(page, ADMIN);
    await openFirstProject(page);
    await expect(page.getByPlaceholder(PLACEHOLDER)).toBeVisible();
  });

  test("admin can submit a note entry", async ({ page }) => {
    await login(page, ADMIN);
    await openFirstProject(page);
    const body = `Note at ${Date.now()}`;
    await page.getByPlaceholder(PLACEHOLDER).fill(body);
    await page.getByRole("button", { name: "Add entry" }).click();
    await expect(page.getByText(body)).toBeVisible({ timeout: 8_000 });
  });

  test("admin can submit a call summary entry via type selector", async ({ page }) => {
    await login(page, ADMIN);
    await openFirstProject(page);
    // Two comboboxes on detail page: stage mover + activity type. Filter to the "Note" one.
    await page.getByRole("combobox").filter({ hasText: "Note" }).click();
    await page.getByRole("option", { name: "Call" }).click();
    const body = `Call summary ${Date.now()}`;
    await page.getByPlaceholder(PLACEHOLDER).fill(body);
    await page.getByRole("button", { name: "Add entry" }).click();
    await expect(page.getByText(body)).toBeVisible({ timeout: 8_000 });
  });

  test("activity log heading is visible", async ({ page }) => {
    await login(page, ADMIN);
    await openFirstProject(page);
    await expect(page.getByText("Activity log")).toBeVisible();
  });

  test("viewer sees read-only notice instead of entry form", async ({ page }) => {
    await login(page, VIEWER);
    await openFirstProject(page);
    await expect(page.getByText(/read-only access/i)).toBeVisible();
    await expect(page.getByPlaceholder(PLACEHOLDER)).not.toBeVisible();
  });

  test("viewer can read the activity log entries", async ({ page }) => {
    await login(page, VIEWER);
    await openFirstProject(page);
    await expect(page.getByText("Activity log")).toBeVisible();
    await expect(page.getByText("Append-only")).toBeVisible();
  });
});
