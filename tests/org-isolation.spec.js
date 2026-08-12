// @ts-check
const { test, expect } = require("@playwright/test");

const SMB_ADMIN = { email: "admin@odigo-test.com", password: "OdigoTest2026!" };
const ENTERPRISE_ADMIN = { email: "admin@enterprise-test.com", password: "OdigoTest2026!" };

async function login(page, user) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/", { timeout: 15_000 });
}

test.describe("Cross-org isolation", () => {
  test("Enterprise admin sees only the Enterprise seed company, never SMB companies", async ({ page }) => {
    await login(page, ENTERPRISE_ADMIN);
    await page.goto("/companies");

    await expect(page.getByText("Enterprise Isolation Test Co")).toBeVisible();
    // "Alderwood Estates" is an Odigo-SMB-org seed company (03_seed.sql) —
    // if RLS's org boundary were broken, an Enterprise-org user would see it.
    await expect(page.getByText("Alderwood Estates")).not.toBeVisible();
  });

  test("SMB admin sees SMB companies, never the Enterprise seed company", async ({ page }) => {
    await login(page, SMB_ADMIN);
    await page.goto("/companies");

    await expect(page.getByText("Alderwood Estates")).toBeVisible();
    await expect(page.getByText("Enterprise Isolation Test Co")).not.toBeVisible();
  });

  test("Enterprise admin cannot fetch an SMB-org record directly by REST ID (RLS, not just UI filtering)", async ({
    page,
    request,
  }) => {
    await login(page, ENTERPRISE_ADMIN);

    // Pull the Enterprise admin's own access token out of the browser session
    // so we can hit PostgREST directly — this proves the boundary is enforced
    // at the DB layer, not just by what the companies-list query happens to filter.
    //
    // This app's Supabase browser client (src/lib/supabase/client.ts) uses
    // @supabase/ssr's createBrowserClient, which persists the session in a
    // cookie (sb-<project-ref>-auth-token), not localStorage — @supabase/ssr's
    // whole purpose is making the session readable by the server via cookies.
    // The cookie value is a "base64-" prefixed, base64-encoded JSON session
    // object (confirmed by probing page.context().storageState() against a
    // live login), so it's decoded accordingly below.
    const storage = await page.context().storageState();
    const authCookie = storage.cookies.find((c) => c.name.includes("auth-token"));
    expect(authCookie, "expected a Supabase auth-token cookie after login").toBeTruthy();
    const rawValue = authCookie.value.startsWith("base64-")
      ? authCookie.value.slice("base64-".length)
      : authCookie.value;
    const session = JSON.parse(Buffer.from(rawValue, "base64").toString("utf-8"));
    const accessToken = session.access_token;

    const smbCompanyResponse = await request.get(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/companies?select=id,name`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    expect(smbCompanyResponse.ok()).toBe(true);
    const rows = await smbCompanyResponse.json();
    const names = rows.map((r) => r.name);
    expect(names).toContain("Enterprise Isolation Test Co");
    expect(names).not.toContain("Alderwood Estates");
  });
});
