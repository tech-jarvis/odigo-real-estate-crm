"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Switches the caller's current org to one of their own active memberships. */
export async function switchOrg(orgId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("org_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) throw new Error("You are not an active member of that organization");

  const { error } = await admin
    .from("profiles")
    .update({ last_active_org_id: orgId })
    .eq("id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
}
