"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type InvitationRow = NonNullable<
  Awaited<ReturnType<typeof fetchInvitationByToken>>["data"]
>;

function fetchInvitationByToken(admin: ReturnType<typeof createAdminClient>, token: string) {
  return admin
    .from("invitations")
    .select("*, organizations(name)")
    .eq("token", token)
    .maybeSingle();
}

async function loadInvitation(
  admin: ReturnType<typeof createAdminClient>,
  token: string
): Promise<{ ok: true; inv: InvitationRow } | { ok: false; error: string }> {
  const { data: inv, error } = await fetchInvitationByToken(admin, token);

  if (error || !inv) return { ok: false, error: "Invitation not found." };
  if (inv.accepted_at) return { ok: false, error: "This invitation has already been accepted." };
  if (inv.cancelled_at) return { ok: false, error: "This invitation has been cancelled." };
  if (inv.declined_at) return { ok: false, error: "This invitation has already been declined." };
  if (new Date(inv.expires_at) < new Date())
    return { ok: false, error: "This invitation has expired." };

  return { ok: true, inv };
}

/** Read-only lookup used to decide whether /accept-invite can auto-accept
 *  (brand-new / first-ever org) or must show an explicit accept/decline
 *  choice (the invitee already has another active org). */
export async function previewInvitation(
  token: string
): Promise<
  | { error: string }
  | { requiresSignIn: true; orgName: string }
  | { orgName: string; hasOtherOrgs: boolean }
> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const loaded = await loadInvitation(admin, token);
  if (!loaded.ok) return { error: loaded.error };
  const { inv } = loaded;
  const orgName = (inv.organizations as { name: string } | null)?.name ?? "the organization";

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { requiresSignIn: true, orgName };

  if (inv.email.toLowerCase() !== user.email?.toLowerCase()) {
    return { error: "This invitation was sent to a different email address." };
  }

  const { count } = await admin
    .from("org_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active");

  return { orgName, hasOtherOrgs: (count ?? 0) > 0 };
}

export async function acceptInvitation(
  token: string
): Promise<{ orgName: string } | { error: string }> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to accept an invitation." };

  const loaded = await loadInvitation(admin, token);
  if (!loaded.ok) return { error: loaded.error };
  const { inv } = loaded;

  if (inv.email.toLowerCase() !== user.email?.toLowerCase()) {
    return { error: "This invitation was sent to a different email address." };
  }

  // Activate (or create) this org's membership — never touches any other org's row.
  const { error: memberErr } = await admin.from("org_members").upsert(
    {
      user_id: user.id,
      org_id: inv.org_id,
      role: inv.crm_role,
      org_role_id: inv.org_role_id ?? null,
      status: "active",
    },
    { onConflict: "user_id,org_id" }
  );
  if (memberErr) return { error: memberErr.message };

  // Only claim it as their current org if they didn't already have one —
  // someone already active elsewhere keeps their context and just gains
  // this org in their switcher.
  await admin
    .from("profiles")
    .update({ last_active_org_id: inv.org_id })
    .eq("id", user.id)
    .is("last_active_org_id", null);

  await admin
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", inv.id);

  const orgName = (inv.organizations as { name: string } | null)?.name ?? "your organization";
  return { orgName };
}

export async function declineInvitation(
  token: string
): Promise<{ orgName: string } | { error: string }> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to decline an invitation." };

  const loaded = await loadInvitation(admin, token);
  if (!loaded.ok) return { error: loaded.error };
  const { inv } = loaded;

  if (inv.email.toLowerCase() !== user.email?.toLowerCase()) {
    return { error: "This invitation was sent to a different email address." };
  }

  await admin
    .from("org_members")
    .delete()
    .eq("user_id", user.id)
    .eq("org_id", inv.org_id)
    .eq("status", "pending");

  await admin
    .from("invitations")
    .update({ declined_at: new Date().toISOString() })
    .eq("id", inv.id);

  const orgName = (inv.organizations as { name: string } | null)?.name ?? "the organization";
  return { orgName };
}

/** In-app accept — used by the pending-invites banner for an already
 *  signed-in user, so they don't need a token/link to act on an invite
 *  that only ever created a pending org_members row (no email sent). */
export async function acceptOrgInvite(
  orgId: string
): Promise<{ orgName: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to accept an invitation." };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("org_members")
    .select("id, status, organizations(name)")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!membership || membership.status !== "pending") {
    return { error: "No pending invitation found for that organization." };
  }

  const { error: memberErr } = await admin
    .from("org_members")
    .update({ status: "active" })
    .eq("id", membership.id);
  if (memberErr) return { error: memberErr.message };

  await admin
    .from("profiles")
    .update({ last_active_org_id: orgId })
    .eq("id", user.id)
    .is("last_active_org_id", null);

  if (user.email) {
    await admin
      .from("invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .ilike("email", user.email)
      .is("accepted_at", null)
      .is("cancelled_at", null)
      .is("declined_at", null);
  }

  revalidatePath("/", "layout");
  const orgName =
    (membership.organizations as unknown as { name: string } | null)?.name ?? "the organization";
  return { orgName };
}

/** In-app decline — counterpart to acceptOrgInvite. */
export async function declineOrgInvite(
  orgId: string
): Promise<{ orgName: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to decline an invitation." };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("org_members")
    .select("id, status, organizations(name)")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!membership || membership.status !== "pending") {
    return { error: "No pending invitation found for that organization." };
  }

  const { error: delErr } = await admin.from("org_members").delete().eq("id", membership.id);
  if (delErr) return { error: delErr.message };

  if (user.email) {
    await admin
      .from("invitations")
      .update({ declined_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .ilike("email", user.email)
      .is("accepted_at", null)
      .is("cancelled_at", null)
      .is("declined_at", null);
  }

  revalidatePath("/", "layout");
  const orgName =
    (membership.organizations as unknown as { name: string } | null)?.name ?? "the organization";
  return { orgName };
}
