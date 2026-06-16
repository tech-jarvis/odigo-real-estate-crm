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

test.describe("Companies — Admin", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/companies");
  });

  test("companies list renders at least one card", async ({ page }) => {
    await expect(page.locator("a[href^='/companies/']").first()).toBeVisible();
  });

  test("shows New company button for admin", async ({ page }) => {
    await expect(page.getByRole("button", { name: /new company/i })).toBeVisible();
  });

  test("admin can create a company", async ({ page }) => {
    const companyName = `E2E Corp ${Date.now()}`;
    await page.getByRole("button", { name: /new company/i }).click();
    // Name field uses id="name" in the company dialog
    await page.locator("#name").fill(companyName);
    await page.getByRole("button", { name: /add company/i }).click();
    await expect(page.getByText(companyName)).toBeVisible({ timeout: 10_000 });
  });

  test("company detail page shows contacts and projects sections", async ({ page }) => {
    await page.locator("a[href^='/companies/']").first().click();
    await page.waitForURL(/\/companies\/.+/);
    await expect(page.getByText("Contacts")).toBeVisible();
    await expect(page.getByText("Projects")).toBeVisible();
    await expect(page.getByText("Company details")).toBeVisible();
  });

  test("admin can add a contact on company detail", async ({ page }) => {
    await page.locator("a[href^='/companies/']").first().click();
    await page.waitForURL(/\/companies\/.+/);
    const addBtn = page.getByRole("button", { name: /add contact/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    const contactName = `E2E Contact ${Date.now()}`;
    // Contact name field uses id="cname"
    await page.locator("#cname").fill(contactName);
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText(contactName)).toBeVisible({ timeout: 10_000 });
  });

  test("segment badge visible on company cards", async ({ page }) => {
    await expect(
      page.getByText(/Residential|Commercial|Industrial/i).first()
    ).toBeVisible();
  });

  test("edit and delete buttons visible for admin on company detail", async ({ page }) => {
    await page.locator("a[href^='/companies/']").first().click();
    await page.waitForURL(/\/companies\/.+/);
    await expect(page.getByRole("button", { name: /edit/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /delete/i }).first()).toBeVisible();
  });
});

test.describe("Companies — Viewer", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, VIEWER);
    await page.goto("/companies");
  });

  test("viewer can see the companies list", async ({ page }) => {
    await expect(page.locator("a[href^='/companies/']").first()).toBeVisible();
  });

  test("viewer does NOT see New company button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /new company/i })).not.toBeVisible();
  });

  test("viewer cannot see edit or delete controls on company detail", async ({ page }) => {
    await page.locator("a[href^='/companies/']").first().click();
    await page.waitForURL(/\/companies\/.+/);
    await expect(page.getByRole("button", { name: /edit company/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /delete/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /add contact/i })).not.toBeVisible();
  });
});
