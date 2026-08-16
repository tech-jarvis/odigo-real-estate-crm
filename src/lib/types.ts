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

// ---------- Multi-org types (migration 14) ----------

export type Organization = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type OrgRole = {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
};

export type PermissionKey =
  | "view_projects"    | "create_projects"   | "edit_projects"    | "delete_projects"   | "archive_projects"
  | "view_companies"   | "create_companies"  | "edit_companies"   | "delete_companies"  | "archive_companies"
  | "view_contacts"    | "create_contacts"   | "edit_contacts"    | "delete_contacts"   | "archive_contacts"
  | "view_activity"    | "manage_members"    | "manage_roles";

export const ALL_PERMISSIONS: PermissionKey[] = [
  "view_projects",    "create_projects",   "edit_projects",    "delete_projects",   "archive_projects",
  "view_companies",   "create_companies",  "edit_companies",   "delete_companies",  "archive_companies",
  "view_contacts",    "create_contacts",   "edit_contacts",    "delete_contacts",   "archive_contacts",
  "view_activity",    "manage_members",    "manage_roles",
];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  view_projects:     "View projects",
  create_projects:   "Create projects",
  edit_projects:     "Edit projects",
  delete_projects:   "Delete projects",
  archive_projects:  "Archive / unarchive projects",
  view_companies:    "View companies",
  create_companies:  "Create companies",
  edit_companies:    "Edit companies",
  delete_companies:  "Delete companies",
  archive_companies: "Archive / unarchive companies",
  view_contacts:     "View contacts",
  create_contacts:   "Create contacts",
  edit_contacts:     "Edit contacts",
  delete_contacts:   "Delete contacts",
  archive_contacts:  "Archive / unarchive contacts",
  view_activity:     "View activity log",
  manage_members:    "Manage members",
  manage_roles:      "Manage roles",
};

export type RolePermission = {
  role_id: string;
  permission: PermissionKey;
};

export type Invitation = {
  id: string;
  org_id: string;
  email: string;
  crm_role: UserRole;
  org_role_id: string | null;
  invited_by: string | null;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

export type OrgWithCount = Organization & { member_count: number };

export type OrgRoleWithPermissions = OrgRole & { permissions: PermissionKey[] };

export type ProfileWithOrg = Profile & {
  organization: Pick<Organization, "id" | "name"> | null;
  org_role: Pick<OrgRole, "id" | "name"> | null;
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
