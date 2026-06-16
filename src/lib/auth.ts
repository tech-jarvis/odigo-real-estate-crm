import { createClient } from "./supabase/server";
import type { Profile } from "./types";

/**
 * Returns the current authenticated user's profile (including role),
 * or null if not signed in. Used by server components/layouts.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
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

  return profile ?? null;
}
