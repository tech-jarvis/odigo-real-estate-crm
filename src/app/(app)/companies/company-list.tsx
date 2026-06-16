"use client";

import Link from "next/link";
import { Building2, ChevronRight, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useRole } from "@/components/shared/role-context";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentBadge } from "@/components/shared/segment-badge";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import type { Company } from "@/lib/types";

type CompanyRow = Company & {
  contacts: { count: number }[];
  projects: { count: number }[];
};

async function fetchCompanies(): Promise<CompanyRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("companies")
    .select(`*, contacts(count), projects(count)`)
    .order("name");
  if (error) throw error;
  return (data ?? []) as unknown as CompanyRow[];
}

function CompaniesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-lg" />
      ))}
    </div>
  );
}

// "companies-full" is separate from "companies" (id, name only) used by the
// project form combobox — they have different shapes so need different keys.
export function CompanyList() {
  const { isAdmin } = useRole();

  const { data: companies = [], isLoading, error } = useQuery({
    queryKey: ["companies-full"],
    queryFn: fetchCompanies,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <CompaniesSkeleton />;
  if (error) return <ErrorState message="Could not load companies." />;

  if (companies.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No companies yet"
        description={
          isAdmin
            ? "Add your first client or subcontractor company."
            : "There are no companies to show."
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {companies.map((c) => {
        const contactCount = c.contacts?.[0]?.count ?? 0;
        const projectCount = c.projects?.[0]?.count ?? 0;
        return (
          <Link key={c.id} href={`/companies/${c.slug}`} className="group">
            <Card className="h-full p-4 transition-all duration-150 hover:border-gold/40 hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium group-hover:text-gold">
                    {c.name}
                  </p>
                  <SegmentBadge segment={c.segment} />
                </div>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {contactCount} contact{contactCount !== 1 ? "s" : ""}
                </div>
                <div>{projectCount} project{projectCount !== 1 ? "s" : ""}</div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
