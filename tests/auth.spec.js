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

async function logout(page) {
  await page.evaluate(async () => { await fetch("/auth/signout", { method: "POST" }); });
  await page.goto("/login");
  await page.waitForURL("/login");
}

test.describe("Authentication", () => {
  test("unauthenticated visit to / redirects to /login", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("/login");
    await expect(page).toHaveURL("/login");
  });

  test("unauthenticated visit to /pipeline redirects to /login", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForURL("/login");
    await expect(page).toHaveURL("/login");
  });

  test("unauthenticated visit to /companies redirects to /login", async ({ page }) => {
    await page.goto("/companies");
    await page.waitForURL("/login");
    await expect(page).toHaveURL("/login");
  });

  test("admin can log in and reach dashboard", async ({ page }) => {
    await login(page, ADMIN);
    await expect(page).toHaveURL("/");
    await expect(page.getByText(/Eddie/i).first()).toBeVisible();
  });

  test("viewer can log in and reach dashboard", async ({ page }) => {
    await login(page, VIEWER);
    await expect(page).toHaveURL("/");
    await expect(page.getByText(/Sam/i).first()).toBeVisible();
  });

  test("authenticated user hitting /login is redirected to /", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/login");
    await page.waitForURL("/");
    await expect(page).toHaveURL("/");
  });

  test("wrong credentials shows error message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("wrong@odigo-test.com");
    await page.getByLabel("Password").fill("WrongPassword1!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("p.text-destructive")).toBeVisible({ timeout: 8_000 });
    await expect(page).toHaveURL("/login");
  });

  test("quick-fill buttons populate credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Use admin" }).click();
    await expect(page.getByLabel("Email")).toHaveValue(ADMIN.email);
    await page.getByRole("button", { name: "Use viewer" }).click();
    await expect(page.getByLabel("Email")).toHaveValue(VIEWER.email);
  });

  test("sign-out clears session and redirects to /login", async ({ page }) => {
    await login(page, ADMIN);
    await logout(page);
    await expect(page).toHaveURL("/login");
    await page.goto("/");
    await page.waitForURL("/login");
    await expect(page).toHaveURL("/login");
  });
});
