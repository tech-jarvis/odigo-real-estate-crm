import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getOrganizationWithMembers } from "@/lib/actions/super-admin";
import { OrgDetailView } from "@/components/super-admin/org-detail-view";

export const dynamic = "force-dynamic";

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const { org, members } = await getOrganizationWithMembers(id);

    return (
      <div>
        <Link
          href="/super-admin/organizations"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to organizations
        </Link>

        <div className="mb-6">
          <h1 className="text-xl font-semibold">{org.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {members.length} member{members.length !== 1 ? "s" : ""} · slug:{" "}
            <code className="rounded bg-secondary px-1 text-xs">{org.slug}</code>
          </p>
        </div>

        <OrgDetailView org={org} members={members} />
      </div>
    );
  } catch {
    notFound();
  }
}
