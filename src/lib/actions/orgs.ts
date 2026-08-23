"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Switches the caller's current org to one of their own active
 * memberships. A single RPC (security definer, checked against
 * auth.uid() internally) instead of a separate check-then-update —
 * that used to be two sequential round-trips through the admin
 * client, which measurably added to how slow switching felt.
 */
export async function switchOrg(orgId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("switch_org", { p_org_id: orgId });
  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
}
