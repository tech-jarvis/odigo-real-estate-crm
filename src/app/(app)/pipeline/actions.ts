"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStage } from "@/lib/types";

type ActionResult = { error: string | null };

function n(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim();
  return s ? s : null;
}

function dbErr(code: string | undefined, message: string): string {
  if (code === "42501") return "Permission denied.";
  return message;
}

async function logActivity(
  projectId: string,
  authorId: string,
  type: "note" | "status_change",
  body: string
) {
  const supabase = await createClient();
  await supabase
    .from("activity_log")
    .insert({ project_id: projectId, author_id: authorId, type, body });
}

export async function createProject(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const name = n(formData.get("name"));
  if (!name) return { error: "Project name is required." };

  const valueRaw = n(formData.get("project_value"));
  const stage = (n(formData.get("stage")) ?? "lead") as ProjectStage;

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name,
      company_id: n(formData.get("company_id")),
      stage,
      start_date: n(formData.get("start_date")),
      estimated_end_date: n(formData.get("estimated_end_date")),
      project_value: valueRaw ? Number(valueRaw) : 0,
      assigned_to: n(formData.get("assigned_to")),
      status_note: n(formData.get("status_note")),
    })
    .select("id")
    .single();

  if (error) return { error: dbErr(error.code, error.message) };

  if (project) {
    await logActivity(
      project.id,
      user.id,
      "note",
      `Project created in ${stage} stage.`
    );
  }

  revalidatePath("/pipeline");
  revalidatePath("/");
  return { error: null };
}

export async function updateProject(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const valueRaw = n(formData.get("project_value"));
  const { error } = await supabase
    .from("projects")
    .update({
      name: n(formData.get("name")) ?? undefined,
      company_id: n(formData.get("company_id")),
      start_date: n(formData.get("start_date")),
      estimated_end_date: n(formData.get("estimated_end_date")),
      project_value: valueRaw ? Number(valueRaw) : 0,
      assigned_to: n(formData.get("assigned_to")),
      status_note: n(formData.get("status_note")),
    })
    .eq("id", id);

  if (error) return { error: dbErr(error.code, error.message) };

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${id}`);
  revalidatePath("/");
  return { error: null };
}

export async function moveProjectStage(
  id: string,
  stage: ProjectStage
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: prev } = await supabase
    .from("projects")
    .select("stage")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("projects")
    .update({ stage })
    .eq("id", id);

  if (error) return { error: dbErr(error.code, error.message) };

  if (prev && prev.stage !== stage) {
    await logActivity(
      id,
      user.id,
      "status_change",
      `Stage moved from ${prev.stage} to ${stage}.`
    );
  }

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${id}`);
  revalidatePath("/");
  return { error: null };
}

export async function archiveProject(
  id: string,
  archived: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("projects")
    .update({ archived })
    .eq("id", id);
  if (error) return { error: dbErr(error.code, error.message) };
  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${id}`);
  return { error: null };
}

/** Soft delete — moves project to trash. Permanent removal happens after 15 days. */
export async function deleteProject(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: dbErr(error.code, error.message) };
  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${id}`);
  revalidatePath("/");
  return { error: null };
}

/** Restore a soft-deleted project from trash back to its previous active/archived state. */
export async function restoreProject(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: null })
    .eq("id", id);
  if (error) return { error: dbErr(error.code, error.message) };
  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${id}`);
  revalidatePath("/");
  return { error: null };
}

/** Permanently and irreversibly removes a project from the database. */
export async function permanentlyDeleteProject(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return { error: dbErr(error.code, error.message) };
  revalidatePath("/pipeline");
  revalidatePath("/");
  return { error: null };
}
