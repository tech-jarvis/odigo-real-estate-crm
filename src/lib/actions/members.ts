"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Invitation, MemberWithRole, Profile, UserRole } from "@/lib/types";
import { isValidEmail, normalizeEmail } from "@/lib/utils";

/** Used by the Add-member form to disable the temp-password field in
 *  real time — the password is meaningless for an email that already
 *  has an account elsewhere, since createMemberWithPassword ignores it
 *  in that case anyway. Requires org-admin auth, same as the invite
 *  itself, so it's not an open enumeration endpoint. */
export async function checkMemberEmailExists(email: string): Promise<boolean> {
  if (!isValidEmail(email)) return false;
  await requireOrgAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", normalizeEmail(email))
    .maybeSingle();

  return !!data;
}

export async function listMembers(orgId: string): Promise<MemberWithRole[]> {
  const { supabase } = await requireOrgAdmin();

  const { data, error } = await supabase
    .from("org_members")
    .select(
      "role, org_role_id, status, created_at, profiles!org_members_user_id_fkey(id, full_name, email, must_change_password)"
    )
    .eq("org_id", orgId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((m) => {
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
}

export async function listPendingInvitations(orgId: string): Promise<Invitation[]> {
  const { supabase } = await requireOrgAdmin();

  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .is("cancelled_at", null)
    .is("declined_at", null)
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
): Promise<{ status: "created" | "pending_existing_user" }> {
  if (!isValidEmail(email)) {
    throw new Error("Invalid email address format");
  }
  const cleanEmail = normalizeEmail(email);
  const { orgId, supabase } = await requireOrgAdmin();
  const admin = createAdminClient();

  const crmRole = await crmRoleFromOrgRole(admin, orgRoleId);

  // Does this email already have an account (in this org or another)?
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", cleanEmail)
    .maybeSingle();

  if (existingProfile) {
    // They already have credentials — don't create a duplicate auth
    // account or set a password for them. Add a pending membership +
    // an invitations row (for the accept flow / audit trail); they
    // must explicitly accept before this org's data becomes visible.
    const { data: { user } } = await supabase.auth.getUser();

    const { data: existingInv } = await admin
      .from("invitations")
      .select("id")
      .eq("org_id", orgId)
      .eq("email", cleanEmail)
      .is("accepted_at", null)
      .is("cancelled_at", null)
      .is("declined_at", null)
      .maybeSingle();

    if (existingInv) {
      await admin
        .from("invitations")
        .update({
          crm_role: crmRole,
          org_role_id: orgRoleId,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", existingInv.id);
    } else {
      const { error: invErr } = await admin.from("invitations").insert({
        org_id: orgId,
        email: cleanEmail,
        crm_role: crmRole,
        org_role_id: orgRoleId,
        invited_by: user?.id ?? null,
      });
      if (invErr) throw new Error(invErr.message);
    }

    const { error: memberErr } = await admin.from("org_members").upsert(
      {
        user_id: existingProfile.id,
        org_id: orgId,
        role: crmRole,
        org_role_id: orgRoleId,
        status: "pending",
        invited_by: user?.id ?? null,
      },
      { onConflict: "user_id,org_id" }
    );
    if (memberErr) throw new Error(memberErr.message);

    revalidatePath("/settings/members");
    return { status: "pending_existing_user" };
  }

  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password: tempPassword,
    email_confirm: true,
  });

  if (authErr) throw new Error(authErr.message);
  const userId = authData.user?.id;
  if (!userId) throw new Error("Auth user creation returned no user");

  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(
      { id: userId, email: cleanEmail, must_change_password: true, last_active_org_id: orgId },
      { onConflict: "id" }
    );
  if (profileErr) throw new Error(profileErr.message);

  const { error: memberErr } = await admin.from("org_members").upsert(
    { user_id: userId, org_id: orgId, role: crmRole, org_role_id: orgRoleId, status: "active" },
    { onConflict: "user_id,org_id" }
  );
  if (memberErr) throw new Error(memberErr.message);

  revalidatePath("/settings/members");
  return { status: "created" };
}

export async function inviteMember(
  orgId: string,
  email: string,
  orgRoleId: string
): Promise<void> {
  if (!isValidEmail(email)) {
    throw new Error("Invalid email address format");
  }
  const cleanEmail = normalizeEmail(email);
  const { supabase } = await requireOrgAdmin();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  const crmRole = await crmRoleFromOrgRole(admin, orgRoleId);

  const { data: existing } = await admin
    .from("invitations")
    .select("id, token")
    .eq("org_id", orgId)
    .eq("email", cleanEmail)
    .is("accepted_at", null)
    .is("cancelled_at", null)
    .is("declined_at", null)
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
        email: cleanEmail,
        crm_role: crmRole,
        org_role_id: orgRoleId,
        invited_by: user?.id ?? null,
      })
      .select("token")
      .single();
    if (error) throw new Error(error.message);
    token = inv!.token;
  }

  // Does this email already have an account (in this org or another)?
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", cleanEmail)
    .maybeSingle();

  if (existingProfile) {
    // Existing identity — no new auth account, no Supabase invite email.
    // Create a pending membership; they must explicitly accept it via
    // /accept-invite (they already have a session to see the notice in).
    const { error: memberErr } = await admin.from("org_members").upsert(
      {
        user_id: existingProfile.id,
        org_id: orgId,
        role: crmRole,
        org_role_id: orgRoleId,
        status: "pending",
        invited_by: user?.id ?? null,
      },
      { onConflict: "user_id,org_id" }
    );
    if (memberErr) throw new Error(memberErr.message);
  } else {
    // Brand-new email — Supabase needs to create the identity and have
    // them set a password via the emailed link.
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3001");
    const redirectTo = `${baseUrl}/accept-invite?token=${token}`;

    const { error: authErr } = await admin.auth.admin.inviteUserByEmail(cleanEmail, {
      redirectTo,
      data: { invitation_token: token },
    });

    if (authErr && !authErr.message.includes("already been registered")) {
      throw new Error(authErr.message);
    }
  }

  revalidatePath("/settings/members");
}

export async function removeMember(userId: string): Promise<void> {
  const { orgId } = await requireOrgAdmin();
  const admin = createAdminClient();

  const { data: target } = await admin
    .from("org_members")
    .select("id")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("status", "active")
    .maybeSingle();

  if (!target) throw new Error("User not in your organization");

  const { error } = await admin
    .from("org_members")
    .update({ status: "revoked" })
    .eq("id", target.id);

  if (error) throw new Error(error.message);

  // If this was their current org, fall back to another active org (or none).
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

  revalidatePath("/settings/members");
}

export async function updateMemberRole(
  userId: string,
  orgRoleId: string
): Promise<void> {
  const { orgId } = await requireOrgAdmin();
  const admin = createAdminClient();

  const { data: target } = await admin
    .from("org_members")
    .select("id")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("status", "active")
    .maybeSingle();

  if (!target) throw new Error("User not in your organization");

  const crmRole = await crmRoleFromOrgRole(admin, orgRoleId);

  const { error } = await admin
    .from("org_members")
    .update({ role: crmRole, org_role_id: orgRoleId })
    .eq("id", target.id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings/members");
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  const { supabase, orgId } = await requireOrgAdmin();
  const admin = createAdminClient();

  const { data: inv } = await supabase
    .from("invitations")
    .select("org_id, email")
    .eq("id", invitationId)
    .single();

  if (inv?.org_id !== orgId) throw new Error("Invitation not in your organization");

  // Clean up any pending membership this invite created for an existing user.
  const { data: invitedProfile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", inv.email)
    .maybeSingle();

  if (invitedProfile) {
    await admin
      .from("org_members")
      .delete()
      .eq("user_id", invitedProfile.id)
      .eq("org_id", orgId)
      .eq("status", "pending");
  }

  await admin.from("invitations").delete().eq("id", invitationId);
  revalidatePath("/settings/members");
}
