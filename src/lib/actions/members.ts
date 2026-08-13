"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Invitation, Profile, UserRole } from "@/lib/types";

async function requireOrgAdmin(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  orgId: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, org_id, is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile) throw new Error("Profile not found");
  if (profile.role !== "admin" && !profile.is_super_admin) {
    throw new Error("Forbidden — admin only");
  }
  if (!profile.org_id && !profile.is_super_admin) {
    throw new Error("No organization assigned");
  }

  return { supabase, orgId: profile.org_id as string };
}

export async function listMembers(orgId: string): Promise<Profile[]> {
  const { supabase } = await requireOrgAdmin();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listPendingInvitations(orgId: string): Promise<Invitation[]> {
  const { supabase } = await requireOrgAdmin();

  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function crmRoleFromOrgRole(
  admin: ReturnType<typeof createAdminClient>,
  orgRoleId: string
): Promise<UserRole> {
  const { data: perms } = await admin
    .from("role_permissions")
    .select("permission")
    .eq("role_id", orgRoleId);
  const hasManage = (perms ?? []).some((p) => p.permission === "manage_members");
  return hasManage ? "admin" : "viewer";
}

export async function createMemberWithPassword(
  email: string,
  orgRoleId: string,
  tempPassword: string
): Promise<void> {
  const { orgId } = await requireOrgAdmin();
  const admin = createAdminClient();

  const crmRole = await crmRoleFromOrgRole(admin, orgRoleId);

  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (authErr) throw new Error(authErr.message);

  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(
      { id: authData.user.id, email, org_id: orgId, role: crmRole, org_role_id: orgRoleId, must_change_password: true },
      { onConflict: "id" }
    );

  if (profileErr) throw new Error(profileErr.message);

  revalidatePath("/settings/members");
}

export async function inviteMember(
  orgId: string,
  email: string,
  orgRoleId: string
): Promise<void> {
  const { supabase } = await requireOrgAdmin();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  const crmRole = await crmRoleFromOrgRole(admin, orgRoleId);

  const { data: existing } = await admin
    .from("invitations")
    .select("id, token")
    .eq("org_id", orgId)
    .eq("email", email)
    .is("accepted_at", null)
    .is("cancelled_at", null)
    .maybeSingle();

  let token: string;
  if (existing) {
    const { data: refreshed } = await admin
      .from("invitations")
      .update({
        crm_role: crmRole,
        org_role_id: orgRoleId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", existing.id)
      .select("token")
      .single();
    token = refreshed!.token;
  } else {
    const { data: inv, error } = await admin
      .from("invitations")
      .insert({
        org_id: orgId,
        email,
        crm_role: crmRole,
        org_role_id: orgRoleId,
        invited_by: user?.id ?? null,
      })
      .select("token")
      .single();
    if (error) throw new Error(error.message);
    token = inv!.token;
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3001");
  const redirectTo = `${baseUrl}/accept-invite?token=${token}`;

  const { error: authErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { invitation_token: token },
  });

  if (authErr && !authErr.message.includes("already been registered")) {
    throw new Error(authErr.message);
  }

  revalidatePath("/settings/members");
}

export async function removeMember(userId: string): Promise<void> {
  const { supabase, orgId } = await requireOrgAdmin();
  const admin = createAdminClient();

  // Verify the target belongs to the same org
  const { data: target } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", userId)
    .single();

  if (target?.org_id !== orgId) throw new Error("User not in your organization");

  // Clear org membership (does not delete the auth user)
  const { error } = await admin
    .from("profiles")
    .update({ org_id: null, org_role_id: null })
    .eq("id", userId);

  if (error) throw new Error(error.message);
  revalidatePath("/settings/members");
}

export async function updateMemberRole(
  userId: string,
  orgRoleId: string
): Promise<void> {
  const { supabase, orgId } = await requireOrgAdmin();
  const admin = createAdminClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", userId)
    .single();

  if (target?.org_id !== orgId) throw new Error("User not in your organization");

  const crmRole = await crmRoleFromOrgRole(admin, orgRoleId);

  const { error } = await admin
    .from("profiles")
    .update({ role: crmRole, org_role_id: orgRoleId })
    .eq("id", userId);

  if (error) throw new Error(error.message);
  revalidatePath("/settings/members");
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  const { supabase, orgId } = await requireOrgAdmin();
  const admin = createAdminClient();

  const { data: inv } = await supabase
    .from("invitations")
    .select("org_id")
    .eq("id", invitationId)
    .single();

  if (inv?.org_id !== orgId) throw new Error("Invitation not in your organization");

  await admin.from("invitations").delete().eq("id", invitationId);
  revalidatePath("/settings/members");
}
