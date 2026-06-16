"use client";

import Link from "next/link";
import { ArrowLeft, Archive, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useRole } from "@/components/shared/role-context";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineBoard } from "./pipeline-board";
import { TrashBoard } from "./trash-board";
import { ProjectFormDialog } from "./project-form-dialog";
import { STAGES } from "@/lib/types";
import type { ProjectWithRelations } from "@/lib/types";

async function fetchProjects(view: string): Promise<ProjectWithRelations[]> {
  const supabase = createClient();
  let query = supabase
    .from("projects")
    .select(
      `*, company:companies(id, name, segment), assignee:profiles!projects_assigned_to_fkey(id, full_name, email)`
    )
    .order("created_at", { ascending: false });

  if (view === "trash") {
    query = query.not("deleted_at", "is", null);
  } else {
    query = query
      .eq("archived", view === "archived")
      .is("deleted_at", null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ProjectWithRelations[];
}

async function fetchCompanies(): Promise<{ id: string; name: string }[]> {
  const supabase = createClient();
  const { data } = await supabase.from("companies").select("id, name").order("name");
  return data ?? [];
}

async function fetchMembers(): Promise<
  { id: string; full_name: string | null; email: string | null }[]
> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name");
  return data ?? [];
}

function PipelineSkeleton() {
  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((s) => (
          <div key={s} className="space-y-2.5">
            <Skeleton className="h-5 w-full" />
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PipelineView({ view }: { view: string }) {
  const { isAdmin } = useRole();
  const showTrash = view === "trash";
  const showArchived = view === "archived";
  const isDefaultView = !showArchived && !showTrash;

  const { data: projects = [], isLoading, error: projectsError } = useQuery({
    queryKey: ["projects", view],
    queryFn: () => fetchProjects(view),
    staleTime: 5 * 60 * 1000,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
    staleTime: 10 * 60 * 1000,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: fetchMembers,
    staleTime: 10 * 60 * 1000,
  });

  // Show skeleton only on the very first load (empty cache).
  // Subsequent navigations hit the React Query browser cache and render instantly.
  if (isLoading) return <PipelineSkeleton />;

  const pageTitle = showTrash
    ? "Trash"
    : showArchived
    ? "Archived Projects"
    : "Pipeline";

  const pageDescription = showTrash
    ? "Deleted projects are kept for 15 days before permanent removal."
    : showArchived
    ? "Archived projects are hidden from the main pipeline."
    : "Every active project, grouped by stage. Drag to move.";

  return (
    <>
      {(showArchived || showTrash) && (
        <Link
          href="/pipeline"
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to pipeline
        </Link>
      )}

      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={
          isDefaultView ? (
            <div className="flex items-center gap-2">
              <Link
                href="/pipeline?show=archived"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Archive className="h-3.5 w-3.5" />
                Archived
              </Link>
              <Link
                href="/pipeline?show=trash"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Trash
              </Link>
              {isAdmin && (
                <ProjectFormDialog
                  companies={companies}
                  members={members}
                  mode="create"
                />
              )}
            </div>
          ) : showArchived ? (
            <Link
              href="/pipeline?show=trash"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Trash
            </Link>
          ) : null
        }
      />

      {projectsError ? (
        <ErrorState message="Could not load the pipeline." />
      ) : showTrash ? (
        <TrashBoard
          projects={
            projects as (ProjectWithRelations & { deleted_at: string })[]
          }
        />
      ) : showArchived ? (
        projects.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="No archived projects"
            description="Projects you archive will appear here."
          />
        ) : (
          <PipelineBoard projects={projects} isAdmin={false} />
        )
      ) : (
        <PipelineBoard projects={projects} isAdmin={isAdmin} />
      )}
    </>
  );
}
