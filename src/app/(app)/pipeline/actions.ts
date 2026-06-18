"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STAGE_META, type ProjectStage } from "@/lib/types";

type ActionResult = { error: string | null };

function n(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim();
  return s ? s : null;
}

function hasHtml(v: FormDataEntryValue | null): boolean {
  return /<[^>]*>/.test((v as string | null) ?? "");
}

function dbErr(code: string | undefined, message: string): string {
  if (code === "42501") return "Permission denied.";
  return message;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "none";
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[m - 1]} ${d}, ${y}`;
}

function fmtMoney(v: number): string {
  return "$" + v.toLocaleString("en-US");
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

  if (hasHtml(formData.get("name"))) return { error: "Project name cannot contain HTML." };
  if (hasHtml(formData.get("status_note"))) return { error: "Status note cannot contain HTML." };
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
  if (hasHtml(formData.get("name"))) return { error: "Project name cannot contain HTML." };
  if (hasHtml(formData.get("status_note"))) return { error: "Status note cannot contain HTML." };

  // Snapshot current state (with display names) before writing so we can diff.
  const { data: prev } = await supabase
    .from("projects")
    .select(`
      name, stage, company_id, start_date, estimated_end_date,
      project_value, assigned_to, status_note,
      company:companies(name),
      assignee:profiles!projects_assigned_to_fkey(full_name, email)
    `)
    .eq("id", id)
    .single();

  const newName       = n(formData.get("name"));
  const newStage      = (n(formData.get("stage")) ?? prev?.stage ?? "lead") as ProjectStage;
  const newCompanyId  = n(formData.get("company_id"));
  const newStartDate  = n(formData.get("start_date"));
  const newEndDate    = n(formData.get("estimated_end_date"));
  const valueRaw      = n(formData.get("project_value"));
  const newValue      = valueRaw ? Number(valueRaw) : 0;
  const newAssignedTo = n(formData.get("assigned_to"));
  const newStatusNote = n(formData.get("status_note"));

  const { error } = await supabase
    .from("projects")
    .update({
      name: newName ?? undefined,
      stage: newStage,
      company_id: newCompanyId,
      start_date: newStartDate,
      estimated_end_date: newEndDate,
      project_value: newValue,
      assigned_to: newAssignedTo,
      status_note: newStatusNote,
    })
    .eq("id", id);

  if (error) return { error: dbErr(error.code, error.message) };

  // Build and log a change summary for all fields that actually changed.
  if (prev) {
    const changes: string[] = [];

    if (newName && newName !== prev.name)
      changes.push(`Name: "${prev.name}" → "${newName}"`);

    if (newStage !== prev.stage) {
      const oldLabel = STAGE_META[prev.stage as ProjectStage]?.label ?? prev.stage;
      const newLabel = STAGE_META[newStage]?.label ?? newStage;
      changes.push(`Stage: "${oldLabel}" → "${newLabel}"`);
    }

    if (newCompanyId !== (prev.company_id ?? null)) {
      const oldCo = (prev.company as { name: string } | null)?.name ?? "none";
      let newCo = "none";
      if (newCompanyId) {
        const { data: co } = await supabase.from("companies").select("name").eq("id", newCompanyId).single();
        newCo = co?.name ?? "unknown";
      }
      changes.push(`Client: "${oldCo}" → "${newCo}"`);
    }

    if (newValue !== Number(prev.project_value))
      changes.push(`Value: ${fmtMoney(Number(prev.project_value))} → ${fmtMoney(newValue)}`);

    if (newStartDate !== (prev.start_date ?? null))
      changes.push(`Start date: ${fmtDate(prev.start_date ?? null)} → ${fmtDate(newStartDate)}`);

    if (newEndDate !== (prev.estimated_end_date ?? null))
      changes.push(`Est. end date: ${fmtDate(prev.estimated_end_date ?? null)} → ${fmtDate(newEndDate)}`);

    if (newAssignedTo !== (prev.assigned_to ?? null)) {
      const prevA = prev.assignee as { full_name: string | null; email: string | null } | null;
      const oldA = prevA ? (prevA.full_name || prevA.email || "Unknown") : "Unassigned";
      let newA = "Unassigned";
      if (newAssignedTo) {
        const { data: prof } = await supabase.from("profiles").select("full_name, email").eq("id", newAssignedTo).single();
        newA = prof ? (prof.full_name || prof.email || "Unknown") : "Unknown";
      }
      changes.push(`Assigned to: "${oldA}" → "${newA}"`);
    }

    if (newStatusNote !== (prev.status_note ?? null))
      changes.push("Status note updated");

    if (changes.length > 0) {
      // Single change → plain string. Multiple → JSON array so the feed can
      // render each item on its own line instead of truncating one long line.
      const body = changes.length === 1 ? changes[0] : JSON.stringify(changes);
      await logActivity(id, user.id, "status_change", body);
    }
  }

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
