import type { Tables, Enums } from "./database.types";

export type Profile = Tables<"profiles">;
export type Company = Tables<"companies">;
export type Contact = Tables<"contacts">;
export type Project = Tables<"projects">;
export type ActivityEntry = Tables<"activity_log">;

export type UserRole = Enums<"user_role">;
export type ProjectStage = Enums<"project_stage">;
export type CompanySegment = Enums<"company_segment">;
export type ActivityType = Enums<"activity_type">;

/** Project joined with its company + assignee for list/board rendering. */
export type ProjectWithRelations = Project & {
  company: Pick<Company, "id" | "name" | "segment"> | null;
  assignee: Pick<Profile, "id" | "full_name" | "email"> | null;
};

export type CompanyWithContacts = Company & {
  contacts: Contact[];
};

export type ActivityWithAuthor = ActivityEntry & {
  author: Pick<Profile, "id" | "full_name" | "email"> | null;
  project?: Pick<Project, "id" | "name" | "slug"> | null;
};

export type ProjectContactLink = {
  contact: Contact & { company: Pick<Company, "id" | "name"> | null };
};

// ---------- Display metadata ----------

export const STAGES: ProjectStage[] = ["lead", "proposal", "active", "completed"];

export const STAGE_META: Record<
  ProjectStage,
  { label: string; dot: string; tint: string }
> = {
  lead: { label: "Lead", dot: "bg-sky-400", tint: "text-sky-300" },
  proposal: { label: "Proposal", dot: "bg-amber-400", tint: "text-amber-300" },
  active: { label: "Active", dot: "bg-emerald-400", tint: "text-emerald-300" },
  completed: { label: "Completed", dot: "bg-zinc-400", tint: "text-zinc-300" },
};

export const SEGMENT_META: Record<CompanySegment, { label: string }> = {
  residential: { label: "Residential" },
  commercial: { label: "Commercial" },
  industrial: { label: "Industrial" },
};

export const ACTIVITY_META: Record<
  ActivityType,
  { label: string; tint: string }
> = {
  note: { label: "Note", tint: "text-zinc-300" },
  status_change: { label: "Status change", tint: "text-emerald-300" },
  file_reference: { label: "File", tint: "text-sky-300" },
  call_summary: { label: "Call", tint: "text-gold" },
};
