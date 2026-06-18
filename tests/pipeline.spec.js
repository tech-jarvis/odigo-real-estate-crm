// @ts-check
const { test, expect } = require("@playwright/test");

const ADMIN = { email: "admin@odigo-test.com", password: "OdigoTest2026!" };
const VIEWER = { email: "viewer@odigo-test.com", password: "OdigoTest2026!" };
const STAGES = ["Lead", "Proposal", "Active", "Completed"];
const PLACEHOLDER = "Add a note, call summary, or status update…";

async function login(page, user) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/", { timeout: 15_000 });
}

test.describe("Pipeline — Admin", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/pipeline");
  });

  test("renders all four stage columns", async ({ page }) => {
    for (const stage of STAGES) {
      await expect(page.getByText(stage, { exact: true }).first()).toBeVisible();
    }
  });

  test("shows New project button for admin", async ({ page }) => {
    await expect(page.getByRole("button", { name: /new project/i })).toBeVisible();
  });

  test("shows archived toggle link", async ({ page }) => {
    await expect(page.getByRole("link", { name: /archived/i })).toBeVisible();
  });

  test("admin can create a project", async ({ page }) => {
    const projectName = `E2E Project ${Date.now()}`;
    await page.getByRole("button", { name: /new project/i }).click();
    // Project name: label "Project name", id="name"
    await page.getByLabel(/project name/i).fill(projectName);
    // Value: label "Value ($)", id="project_value"
    await page.locator("#project_value").fill("99000");
    await page.getByRole("button", { name: /create project/i }).click();
    // Wait for dialog to close, then reload to pick up the server-rendered board update
    await page.waitForSelector('[role="dialog"]', { state: "hidden", timeout: 10_000 });
    await page.goto("/pipeline");
    await expect(page.getByText(projectName)).toBeVisible({ timeout: 10_000 });
  });

  test("project detail page loads with all sections", async ({ page }) => {
    await page.locator("a[href^='/pipeline/']").first().click();
    await page.waitForURL(/\/pipeline\/.+/);
    await expect(page.getByText("Details")).toBeVisible();
    await expect(page.getByText("Activity log")).toBeVisible();
    await expect(page.getByText("Append-only")).toBeVisible();
  });

  test("admin can add an activity log entry from project detail", async ({ page }) => {
    await page.locator("a[href^='/pipeline/']").first().click();
    await page.waitForURL(/\/pipeline\/.+/);
    const noteText = `E2E note ${Date.now()}`;
    await page.getByPlaceholder(PLACEHOLDER).fill(noteText);
    await page.getByRole("button", { name: /add entry/i }).click();
    await expect(page.getByText(noteText)).toBeVisible({ timeout: 8_000 });
  });

  test("archived view toggle shows Archived Projects heading", async ({ page }) => {
    await page.getByRole("link", { name: /archived/i }).click();
    await page.waitForURL(/\?show=archived/);
    await expect(page.getByRole("heading", { name: "Archived Projects" })).toBeVisible();
    // New nav: "Back to pipeline" link replaces the old "Active projects" toggle
    await expect(page.getByRole("link", { name: /back to pipeline/i })).toBeVisible();
  });

  test("back link from archived view returns to active pipeline", async ({ page }) => {
    await page.goto("/pipeline?show=archived");
    await page.getByRole("link", { name: /back to pipeline/i }).click();
    await page.waitForURL("/pipeline");
    await expect(page.getByRole("heading", { name: "Pipeline" })).toBeVisible();
  });
});

test.describe("Pipeline — Viewer", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, VIEWER);
    await page.goto("/pipeline");
  });

  test("viewer sees all four stage columns", async ({ page }) => {
    for (const stage of STAGES) {
      await expect(page.getByText(stage, { exact: true }).first()).toBeVisible();
    }
  });

  test("viewer does NOT see New project button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /new project/i })).not.toBeVisible();
  });

  test("viewer sees read-only notice on project detail", async ({ page }) => {
    await page.locator("a[href^='/pipeline/']").first().click();
    await page.waitForURL(/\/pipeline\/.+/);
    await expect(page.getByText(/read-only access/i)).toBeVisible();
    await expect(page.getByPlaceholder(PLACEHOLDER)).not.toBeVisible();
  });

  test("viewer does NOT see archive or delete controls on project", async ({ page }) => {
    await page.locator("a[href^='/pipeline/']").first().click();
    await page.waitForURL(/\/pipeline\/.+/);
    await expect(page.getByRole("button", { name: /^archive$/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /^delete$/i })).not.toBeVisible();
  });
});
