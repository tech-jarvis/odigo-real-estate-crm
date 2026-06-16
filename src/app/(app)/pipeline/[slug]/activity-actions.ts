"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActivityType } from "@/lib/types";

export async function addActivity(
  projectId: string,
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const type = (formData.get("type") as ActivityType | null) ?? "note";
  const rawBody = (formData.get("body") as string | null)?.trim();
  const file_url = (formData.get("file_url") as string | null)?.trim() || null;
  const file_name = (formData.get("file_name") as string | null)?.trim() || null;

  let body: string;
  if (type === "file_reference") {
    if (!file_url) return { error: "File upload is required." };
    body = rawBody || file_name || "File";
  } else {
    if (!rawBody) return { error: "Entry cannot be empty." };
    body = rawBody;
  }

  // Append-only: insert only. RLS also blocks update/delete at the DB layer.
  const { error } = await supabase.from("activity_log").insert({
    project_id: projectId,
    author_id: user.id,
    type,
    body,
    file_url,
  });

  if (error) return { error: error.code === "42501" ? "Permission denied." : error.message };

  revalidatePath(`/pipeline/${projectId}`);
  revalidatePath("/");
  return { error: null };
}
