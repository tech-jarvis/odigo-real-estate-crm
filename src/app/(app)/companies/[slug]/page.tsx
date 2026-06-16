import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  User,
  Users,
  FolderKanban,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentBadge } from "@/components/shared/segment-badge";
import { StageBadge } from "@/components/shared/stage-badge";
import { Avatar } from "@/components/shared/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { CompanyFormDialog } from "../company-form-dialog";
import { ContactFormDialog } from "./contact-form-dialog";
import { DeleteCompanyButton } from "./company-controls";
import { DeleteContactButton } from "./delete-contact-button";
import { formatCurrency } from "@/lib/utils";
import type { Company, Contact, Project } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";

  // Look up company by slug (not UUID)
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!company) notFound();
  const c = company as Company;

  const [{ data: contacts }, { data: projects }] = await Promise.all([
    supabase.from("contacts").select("*").eq("company_id", c.id).order("name"),
    supabase
      .from("projects")
      .select("id, name, stage, project_value, slug")
      .eq("company_id", c.id)
      .eq("archived", false)
      .order("created_at", { ascending: false }),
  ]);

  const contactList = (contacts ?? []) as Contact[];
  const projectList = (projects ?? []) as Pick<
    Project,
    "id" | "name" | "stage" | "project_value" | "slug"
  >[];

  return (
    <div className="animate-fade-in">
      <Link
        href="/companies"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to clients
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {c.name}
            </h1>
            <SegmentBadge segment={c.segment} />
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <CompanyFormDialog mode="edit" company={c} />
            <DeleteCompanyButton id={c.id} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ---------- Company info ---------- */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Company details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow icon={User} value={c.primary_contact} />
              <InfoRow icon={MapPin} value={c.address} />
              <InfoRow icon={Phone} value={c.phone} />
              <InfoRow icon={Mail} value={c.email} />
            </CardContent>
          </Card>

          {c.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-foreground/90">
                {c.notes}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ---------- Contacts + projects ---------- */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" /> Contacts
              </CardTitle>
              {isAdmin && <ContactFormDialog companyId={c.id} mode="create" />}
            </CardHeader>
            <CardContent>
              {contactList.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">
                  No contacts yet.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {contactList.map((ct) => (
                    <li
                      key={ct.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={ct.name} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {ct.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[ct.role, ct.email, ct.phone]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex shrink-0 items-center">
                          <ContactFormDialog
                            companyId={c.id}
                            mode="edit"
                            contact={ct}
                          />
                          <DeleteContactButton id={ct.id} companyId={c.id} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />{" "}
                Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              {projectList.length === 0 ? (
                <EmptyState
                  title="No projects"
                  description="This company has no active projects."
                  className="py-8"
                />
              ) : (
                <ul className="">
                  {projectList.map((p, i) => (
                    <li key={p.id}>
                      <Link
                        href={`/pipeline/${p.slug}`}
                        className={`group flex items-center justify-between gap-3  ${i < projectList.length - 1 ? "border-b !pb-2 mb-2" : "pb-3"}  first:pt-0 last:pb-0`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5 ">
                          <StageBadge stage={p.stage} />
                          <span className="truncate text-sm font-medium group-hover:text-gold">
                            {p.name}
                          </span>
                        </div>
                        <span className="shrink-0 text-sm font-medium text-muted-foreground">
                          {formatCurrency(Number(p.project_value))}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  value,
}: {
  icon: typeof MapPin;
  value: string | null;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className={value ? "text-foreground/90" : "text-muted-foreground"}>
        {value || "—"}
      </span>
    </div>
  );
}
