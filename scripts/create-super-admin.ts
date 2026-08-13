/**
 * One-time setup: creates a super admin account on the Supabase project.
 *
 * Usage:
 *   SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   SUPER_ADMIN_EMAIL=superadmin@odigo.com \
 *   SUPER_ADMIN_PASSWORD=Password123! \
 *   npx ts-node --esm scripts/create-super-admin.ts
 *
 * Or set these in .env.local and run with dotenv:
 *   npx dotenv -e .env.local -- npx ts-node --esm scripts/create-super-admin.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.env.SUPER_ADMIN_EMAIL ?? "superadmin@odigo.com";
const PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !PASSWORD) {
  console.error(
    "Missing required env vars: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), " +
      "SUPABASE_SERVICE_ROLE_KEY, SUPER_ADMIN_PASSWORD"
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log(`Creating super admin: ${EMAIL}`);

  // 1. Check if user already exists
  const { data: existing } = await admin.auth.admin.listUsers();
  const existingUser = existing?.users?.find((u) => u.email === EMAIL);

  let userId: string;

  if (existingUser) {
    console.log(`User ${EMAIL} already exists — promoting to super admin.`);
    userId = existingUser.id;
  } else {
    // 2. Create the auth user
    const { data: created, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });

    if (error || !created?.user) {
      console.error("Failed to create user:", error?.message);
      process.exit(1);
    }

    userId = created.user.id;
    console.log(`Auth user created: ${userId}`);
  }

  // 3. Upsert profile with is_super_admin = true
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: EMAIL,
        full_name: "Super Admin",
        role: "admin",
        is_super_admin: true,
      },
      { onConflict: "id" }
    );

  if (profileErr) {
    console.error("Failed to upsert profile:", profileErr.message);
    process.exit(1);
  }

  console.log(`✓ Super admin ready.`);
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Login at: /login`);
  console.log(`  Panel at: /super-admin`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
