"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Organization, OrgWithCount, Profile, UserRole } from "@/lib/types";
import { isValidEmail, normalizeEmail } from "@/lib/utils";

async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) throw new Error("Forbidden — super admin only");
  return supabase;
}

export async function listOrganizations(): Promise<OrgWithCount[]> {
  const supabase = await requireSuperAdmin();

  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("org_id")
    .not("org_id", "is", null);

  const counts = (profiles ?? []).reduce<Record<string, number>>((acc, p) => {
    if (p.org_id) acc[p.org_id] = (acc[p.org_id] ?? 0) + 1;
    return acc;
  }, {});

  return (orgs ?? []).map((o) => ({ ...o, member_count: counts[o.id] ?? 0 }));
}

export async function getOrganizationWithMembers(
  id: string
): Promise<{ org: Organization; members: Profile[] }> {
  const supabase = await requireSuperAdmin();

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .single();

  if (orgErr || !org) throw new Error("Organization not found");

  const { data: members, error: memErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("org_id", id)
    .order("created_at", { ascending: true });

  if (memErr) throw new Error(memErr.message);

  return { org, members: members ?? [] };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createOrganization(
  name: string,
  adminEmail: string,
  tempPassword: string
): Promise<{ org: Organization }> {
  if (!isValidEmail(adminEmail)) {
    throw new Error("Invalid admin email address format");
  }
  const cleanEmail = normalizeEmail(adminEmail);
  await requireSuperAdmin();
  const admin = createAdminClient();

  const slug = slugify(name);

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name, slug })
    .select()
    .single();

  if (orgErr) throw new Error(orgErr.message);

  // Create auth user with confirmed email and temp password
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password: tempPassword,
    email_confirm: true,
  });

  if (authErr) {
    // Roll back org creation
    await admin.from("organizations").delete().eq("id", org.id);
    throw new Error(authErr.message);
  }

  const userId = authData.user.id;

  // Upsert handles both: trigger already ran (update) and hasn't run yet (insert)
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(
      { id: userId, email: cleanEmail, org_id: org.id, role: "admin", must_change_password: true },
      { onConflict: "id" }
    );

  if (profileErr) throw new Error(profileErr.message);

  revalidatePath("/super-admin/organizations");
  return { org };
}

export async function createOrgMember(
  orgId: string,
  email: string,
  tempPassword: string,
  crmRole: UserRole
): Promise<void> {
  if (!isValidEmail(email)) {
    throw new Error("Invalid email address format");
  }
  const cleanEmail = normalizeEmail(email);
  await requireSuperAdmin();
  const admin = createAdminClient();

  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password: tempPassword,
    email_confirm: true,
  });

  if (authErr) throw new Error(authErr.message);

  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(
      { id: authData.user.id, email: cleanEmail, org_id: orgId, role: crmRole, must_change_password: true },
      { onConflict: "id" }
    );

  if (profileErr) throw new Error(profileErr.message);

  revalidatePath(`/super-admin/organizations/${orgId}`);
}

export async function removeOrgMember(userId: string, orgId: string): Promise<void> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("org_id")
    .eq("id", userId)
    .single();

  if (target?.org_id !== orgId) throw new Error("User not in this organization");

  const { error } = await admin
    .from("profiles")
    .update({ org_id: null, org_role_id: null, must_change_password: false })
    .eq("id", userId);

  if (error) throw new Error(error.message);
  revalidatePath(`/super-admin/organizations/${orgId}`);
}

export async function deleteOrganization(id: string): Promise<void> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const { error } = await admin.from("organizations").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/super-admin/organizations");
}
