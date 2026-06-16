"use client";

import Link from "next/link";
import {
  FolderKanban,
  DollarSign,
  CalendarClock,
  TrendingUp,
  History,
  ArrowRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { StageBadge } from "@/components/shared/stage-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { PipelineValueChart, type ChartDatum } from "./pipeline-value-chart";
import { STAGES, STAGE_META } from "@/lib/types";
import type { Project, ActivityWithAuthor, ProjectStage } from "@/lib/types";
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils";

interface DashboardData {
  projects: Pick<
    Project,
    "id" | "name" | "stage" | "project_value" | "estimated_end_date" | "slug"
  >[];
  entries: ActivityWithAuthor[];
  greeting: string;
  userName: string;
}

async function fetchDashboardData(): Promise<DashboardData> {
  const supabase = createClient();

  const [{ data: projects }, { data: recent }, profileData] = await Promise.all(
    [
      supabase
        .from("projects")
        .select("id, name, stage, project_value, estimated_end_date, slug")
        .eq("archived", false)
        .is("deleted_at", null),
      supabase
        .from("activity_log")
        .select(`*, author:profiles(id, full_name, email)`)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.auth.getUser(),
    ],
  );

  const h = new Date().getHours();
  const greetingText =
    h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";

  const profile = profileData.data?.user;
  const userName = profile?.user_metadata?.full_name?.split(" ")[0] ?? "there";

  return {
    projects: (projects ?? []) as Pick<
      Project,
      "id" | "name" | "stage" | "project_value" | "estimated_end_date" | "slug"
    >[],
    entries: (recent ?? []) as unknown as ActivityWithAuthor[],
    greeting: greetingText,
    userName,
  };
}

function DashboardSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-1 h-4 w-96" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Chart + closing soon skeleton */}
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-72" />
        </div>

        {/* Activity skeleton */}
        <div className="lg:col-span-1">
          <Skeleton className="h-96" />
        </div>
      </div>
    </div>
  );
}

export function DashboardView() {
  const {
    data = null,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboardData,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // Show skeleton only on the very first load (empty cache).
  // Subsequent navigations hit the React Query browser cache and render instantly.
  if (isLoading) return <DashboardSkeleton />;

  if (error) {
    return (
      <ErrorState
        title="Dashboard unavailable"
        message="Could not load dashboard data. Please try refreshing."
      />
    );
  }

  if (!data) return <DashboardSkeleton />;

  const { projects: all, entries, greeting, userName } = data;

  // ----- Aggregates -----
  const totalValue = all.reduce((s, p) => s + Number(p.project_value), 0);
  const openValue = all
    .filter((p) => p.stage !== "completed")
    .reduce((s, p) => s + Number(p.project_value), 0);

  const countByStage = (stage: ProjectStage) =>
    all.filter((p) => p.stage === stage).length;

  const chartData: ChartDatum[] = STAGES.map((stage) => ({
    stage,
    label: STAGE_META[stage].label,
    value: all
      .filter((p) => p.stage === stage)
      .reduce((s, p) => s + Number(p.project_value), 0),
    count: countByStage(stage),
  }));

  const closingSoon = all
    .filter((p) => {
      const d = daysUntil(p.estimated_end_date);
      return d !== null && d >= 0 && d <= 30 && p.stage !== "completed";
    })
    .sort(
      (a, b) =>
        (daysUntil(a.estimated_end_date) ?? 0) -
        (daysUntil(b.estimated_end_date) ?? 0),
    );

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {greeting}, {userName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s where the pipeline stands today.
        </p>
      </div>

      {/* ----- Stat cards ----- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={FolderKanban}
          label="Active projects"
          value={String(all.length)}
          hint={`${countByStage("active")} in build`}
        />
        <StatCard
          icon={DollarSign}
          label="Open pipeline"
          value={formatCurrency(openValue)}
          hint="Excludes completed"
          accent
        />
        <StatCard
          icon={TrendingUp}
          label="Total value"
          value={formatCurrency(totalValue)}
          hint="All stages"
        />
        <StatCard
          icon={CalendarClock}
          label="Closing ≤ 30d"
          value={String(closingSoon.length)}
          hint="Est. end date"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ----- Chart + closing soon ----- */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Pipeline value by stage</CardTitle>
              <p className="text-xs text-muted-foreground">
                Where the money sits across the pipeline.
              </p>
            </CardHeader>
            <CardContent>
              {totalValue === 0 ? (
                <EmptyState
                  title="No pipeline data"
                  description="Add projects to see value distribution."
                  className="py-10"
                />
              ) : (
                <PipelineValueChart data={chartData} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CalendarClock className="h-4 w-4 text-gold" /> Closing in the
                next 30 days
              </CardTitle>
            </CardHeader>
            <CardContent>
              {closingSoon.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">
                  Nothing scheduled to close in the next 30 days.
                </p>
              ) : (
                <ul>
                  {closingSoon.map((p, i) => {
                    const d = daysUntil(p.estimated_end_date);
                    return (
                      <li key={p.id}>
                        <Link
                          href={`/pipeline/${p.slug}`}
                          className={`group flex items-center justify-between gap-3  ${i < closingSoon.length - 1 ? "border-b !pb-2 mb-2" : "pb-3"}  first:pt-0 last:pb-0`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5 ">
                            <StageBadge stage={p.stage} />
                            <span className="truncate text-sm font-medium group-hover:text-gold">
                              {p.name}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-4">
                            <span className="text-xs font-medium text-gold">
                              {d}d left
                            </span>
                            <span className="hidden text-xs text-muted-foreground sm:inline">
                              {formatDate(p.estimated_end_date)}
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ----- Recent activity ----- */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4 text-muted-foreground" /> Recent
                activity
              </CardTitle>
              <Link
                href="/pipeline"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-gold"
              >
                Pipeline <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="No activity yet"
                  className="py-8"
                />
              ) : (
                <ActivityFeed entries={entries} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
