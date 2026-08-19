"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MemberWithRole, Organization, OrgWithCount, Profile } from "@/lib/types";
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

  const { data: members } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("status", "active");

  const counts = (members ?? []).reduce<Record<string, number>>((acc, m) => {
    acc[m.org_id] = (acc[m.org_id] ?? 0) + 1;
    return acc;
  }, {});

  return (orgs ?? []).map((o) => ({ ...o, member_count: counts[o.id] ?? 0 }));
}

export async function getOrganizationWithMembers(
  id: string
): Promise<{ org: Organization; members: MemberWithRole[] }> {
  const supabase = await requireSuperAdmin();

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .single();

  if (orgErr || !org) throw new Error("Organization not found");

  const { data: rows, error: memErr } = await supabase
    .from("org_members")
    .select(
      "role, org_role_id, status, created_at, profiles(id, full_name, email, must_change_password)"
    )
    .eq("org_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (memErr) throw new Error(memErr.message);

  const members: MemberWithRole[] = (rows ?? []).map((m) => {
    const p = m.profiles as unknown as Pick<
      Profile,
      "id" | "full_name" | "email" | "must_change_password"
    >;
    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      must_change_password: p.must_change_password,
      role: m.role,
      org_role_id: m.org_role_id,
      status: m.status,
      joined_at: m.created_at,
    };
  });

  return { org, members };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const ADMIN_PERMISSIONS = [
  "view_projects", "create_projects", "edit_projects", "delete_projects", "archive_projects",
  "view_companies", "create_companies", "edit_companies", "delete_companies", "archive_companies",
  "view_contacts", "create_contacts", "edit_contacts", "delete_contacts", "archive_contacts",
  "view_activity", "manage_members", "manage_roles",
] as const;

const VIEWER_PERMISSIONS = [
  "view_projects", "view_companies", "view_contacts", "view_activity",
] as const;

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

  // 1. Create the organization
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name, slug })
    .select()
    .single();

  if (orgErr) throw new Error(orgErr.message);

  // 2. Create auth user
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password: tempPassword,
    email_confirm: true,
  });

  if (authErr) {
    await admin.from("organizations").delete().eq("id", org.id);
    throw new Error(authErr.message);
  }

  const userId = authData.user?.id;
  if (!userId) {
    await admin.from("organizations").delete().eq("id", org.id);
    throw new Error("Auth user creation returned no user");
  }

  // 3. Seed default Admin org role
  const { data: adminRole, error: adminRoleErr } = await admin
    .from("org_roles")
    .insert({ org_id: org.id, name: "Admin" })
    .select("id")
    .single();

  if (adminRoleErr) {
    await admin.from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(userId);
    throw new Error(adminRoleErr.message);
  }

  // 4. Seed default Viewer org role
  const { data: viewerRole, error: viewerRoleErr } = await admin
    .from("org_roles")
    .insert({ org_id: org.id, name: "Viewer" })
    .select("id")
    .single();

  if (viewerRoleErr) {
    await admin.from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(userId);
    throw new Error(viewerRoleErr.message);
  }

  // 5. Seed Admin role permissions (full access)
  const { error: adminPermsErr } = await admin.from("role_permissions").insert(
    ADMIN_PERMISSIONS.map((permission) => ({ role_id: adminRole.id, permission }))
  );
  if (adminPermsErr) {
    await admin.from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(userId);
    throw new Error(adminPermsErr.message);
  }

  // 6. Seed Viewer role permissions (read-only)
  const { error: viewerPermsErr } = await admin.from("role_permissions").insert(
    VIEWER_PERMISSIONS.map((permission) => ({ role_id: viewerRole.id, permission }))
  );
  if (viewerPermsErr) {
    await admin.from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(userId);
    throw new Error(viewerPermsErr.message);
  }

  // 7. Create the admin's profile
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: cleanEmail,
        must_change_password: true,
        last_active_org_id: org.id,
      },
      { onConflict: "id" }
    );

  if (profileErr) {
    await admin.from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(userId);
    throw new Error(profileErr.message);
  }

  // 8. Link the admin to the org via an active membership
  const { error: memberErr } = await admin.from("org_members").insert({
    user_id: userId,
    org_id: org.id,
    role: "admin",
    org_role_id: adminRole.id,
    status: "active",
  });

  if (memberErr) {
    await admin.from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(userId);
    throw new Error(memberErr.message);
  }

  revalidatePath("/super-admin/organizations");
  return { org };
}

export async function removeOrgMember(userId: string, orgId: string): Promise<void> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const { data: target } = await admin
    .from("org_members")
    .select("id")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("status", "active")
    .maybeSingle();

  if (!target) throw new Error("User not in this organization");

  const { error } = await admin
    .from("org_members")
    .update({ status: "revoked" })
    .eq("id", target.id);

  if (error) throw new Error(error.message);

  const { data: fallback } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .neq("org_id", orgId)
    .limit(1)
    .maybeSingle();

  await admin
    .from("profiles")
    .update({ last_active_org_id: fallback?.org_id ?? null })
    .eq("id", userId)
    .eq("last_active_org_id", orgId);

  revalidatePath(`/super-admin/organizations/${orgId}`);
}

export async function deleteOrganization(id: string): Promise<void> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const { error } = await admin.from("organizations").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/super-admin/organizations");
}
