"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function acceptInvitation(
  token: string
): Promise<{ orgName: string } | { error: string }> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to accept an invitation." };

  // Look up the invitation
  const { data: inv, error: invErr } = await admin
    .from("invitations")
    .select("*, organizations(name)")
    .eq("token", token)
    .maybeSingle();

  if (invErr || !inv) return { error: "Invitation not found." };
  if (inv.accepted_at) return { error: "This invitation has already been accepted." };
  if (inv.cancelled_at) return { error: "This invitation has been cancelled." };
  if (new Date(inv.expires_at) < new Date()) return { error: "This invitation has expired." };
  if (inv.email.toLowerCase() !== user.email?.toLowerCase()) {
    return { error: "This invitation was sent to a different email address." };
  }

  // Apply the invitation: set org + role on the profile
  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      org_id: inv.org_id,
      role: inv.crm_role,
      org_role_id: inv.org_role_id ?? null,
    })
    .eq("id", user.id);

  if (profileErr) return { error: profileErr.message };

  // Mark accepted
  await admin
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", inv.id);

  const orgName = (inv.organizations as { name: string } | null)?.name ?? "your organization";
  return { orgName };
}
