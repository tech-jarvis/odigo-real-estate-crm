import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CalendarClock,
  DollarSign,
  User,
  Users,
  History,
  Lock,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StageBadge } from "@/components/shared/stage-badge";
import { Avatar } from "@/components/shared/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { AddActivityForm } from "@/components/activity/add-activity-form";
import { ProjectFormDialog } from "../project-form-dialog";
import { ProjectControls } from "./project-controls";
import { StageMover } from "./stage-mover";
import { formatCurrency, formatDate } from "@/lib/utils";
import type {
  ProjectWithRelations,
  ActivityWithAuthor,
  Contact,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";

  // Look up project by slug (not UUID)
  const { data: project } = await supabase
    .from("projects")
    .select(
      `*, company:companies(id, name, segment, slug), assignee:profiles!projects_assigned_to_fkey(id, full_name, email)`
    )
    .eq("slug", slug)
    .single();

  if (!project) notFound();
  const p = project as unknown as ProjectWithRelations & { company: any };

  const [{ data: activity }, { data: links }, { data: companies }, { data: members }] =
    await Promise.all([
      supabase
        .from("activity_log")
        .select(`*, author:profiles(id, full_name, email)`)
        .eq("project_id", p.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("project_contacts")
        .select(`contact:contacts(*)`)
        .eq("project_id", p.id),
      supabase.from("companies").select("id, name, slug").order("name"),
      supabase.from("profiles").select("id, full_name, email").order("full_name"),
    ]);

  const contacts = (links ?? [])
    .map((l) => l.contact as unknown as Contact | null)
    .filter(Boolean) as Contact[];
  const entries = (activity ?? []) as unknown as ActivityWithAuthor[];

  return (
    <div className="animate-fade-in">
      <Link
        href={p.deleted_at ? "/pipeline?show=trash" : "/pipeline"}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {p.deleted_at ? "Back to trash" : "Back to pipeline"}
      </Link>

      {/* Trash banner */}
      {p.deleted_at && (
        <div className="mb-5 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <Trash2 className="h-4 w-4 shrink-0" />
          This project is in the trash. Restore it or it will be permanently
          deleted after 15 days.
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: title + meta */}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {p.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <StageBadge stage={p.stage} />
            {p.archived && <Badge variant="outline">Archived</Badge>}
            {p.company && (
              <Link
                href={`/companies/${p.company.slug}`}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold"
              >
                <Building2 className="h-3.5 w-3.5" /> {p.company.name}
              </Link>
            )}
          </div>
        </div>

        {/* Right: action buttons */}
        {isAdmin && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <StageMover projectId={p.id} stage={p.stage} />
            <ProjectFormDialog
              mode="edit"
              project={p}
              companies={companies ?? []}
              members={members ?? []}
            />
            <ProjectControls
              projectId={p.id}
              archived={p.archived}
              deletedAt={p.deleted_at ?? null}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ---------- Left: details ---------- */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 text-sm">
              <DetailRow
                icon={DollarSign}
                label="Value"
                value={formatCurrency(Number(p.project_value))}
              />
              <DetailRow
                icon={User}
                label="Assigned to"
                value={
                  p.assignee ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar
                        name={p.assignee.full_name}
                        className="h-5 w-5 text-[9px]"
                      />
                      {p.assignee.full_name ?? p.assignee.email}
                    </span>
                  ) : (
                    "Unassigned"
                  )
                }
              />
              <DetailRow
                icon={CalendarDays}
                label="Start"
                value={formatDate(p.start_date)}
              />
              <DetailRow
                icon={CalendarClock}
                label="Est. end"
                value={formatDate(p.estimated_end_date)}
              />
            </CardContent>
          </Card>

          {p.status_note && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Status note</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-foreground/90">
                {p.status_note}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" /> Contacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No contacts linked.
                </p>
              ) : (
                <ul className="space-y-3">
                  {contacts.map((c) => (
                    <li key={c.id} className="flex items-start gap-2.5">
                      <Avatar name={c.name} className="mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.role ?? "—"}
                          {c.email ? ` · ${c.email}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ---------- Right: activity log ---------- */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4 text-muted-foreground" /> Activity
                log
              </CardTitle>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" /> Append-only
              </span>
            </CardHeader>
            <CardContent className="space-y-5">
              {isAdmin ? (
                <AddActivityForm projectId={p.id} />
              ) : (
                <p className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
                  You have read-only access. Only admins can add log entries.
                </p>
              )}

              <div className="border-t border-border pt-5">
                {entries.length === 0 ? (
                  <EmptyState
                    icon={History}
                    title="No activity yet"
                    description="Notes, calls, and status changes will appear here."
                    className="py-10"
                  />
                ) : (
                  <ActivityFeed entries={entries} />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof DollarSign;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
