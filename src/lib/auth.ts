import { createClient } from "./supabase/server";
import type { CurrentUser, OrgMembershipWithOrg } from "./types";

/**
 * Returns the current authenticated user's profile plus their active
 * org memberships and resolved "current org" (last_active_org_id if
 * it's still an active membership, else their first active org, else
 * null if they belong to none). Used by server components/layouts and
 * by requireOrgAdmin below.
 */
export async function getCurrentProfile(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const { data: memberships } = await supabase
    .from("org_members")
    .select("org_id, role, org_role_id, status, organizations(id, name, slug)")
    .eq("user_id", user.id)
    .eq("status", "active");

  const active = (memberships ?? []) as unknown as OrgMembershipWithOrg[];

  const currentOrgId =
    profile.last_active_org_id && active.some((m) => m.org_id === profile.last_active_org_id)
      ? profile.last_active_org_id
      : (active[0]?.org_id ?? null);

  const current = active.find((m) => m.org_id === currentOrgId) ?? null;

  const { data: pending } = await supabase
    .from("org_members")
    .select("org_id, role, org_role_id, status, organizations(id, name, slug)")
    .eq("user_id", user.id)
    .eq("status", "pending");

  return {
    profile,
    memberships: active,
    currentOrgId,
    currentRole: current?.role ?? null,
    currentOrgRoleId: current?.org_role_id ?? null,
    pendingInvites: (pending ?? []) as unknown as OrgMembershipWithOrg[],
  };
}

/**
 * Requires the caller to be an admin (org_members.role === "admin")
 * in their current org. Returns the org-scoped supabase client and
 * the current org's id for use by org-admin server actions.
 */
export async function requireOrgAdmin(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  orgId: string;
}> {
  const supabase = await createClient();
  const current = await getCurrentProfile();

  if (!current) throw new Error("Not authenticated");
  if (!current.currentOrgId) throw new Error("No organization assigned");
  if (current.currentRole !== "admin") throw new Error("Forbidden — admin only");

  return { supabase, orgId: current.currentOrgId };
}
