import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CreateOrgForm } from "@/components/super-admin/create-org-form";

export default function NewOrganizationPage() {
  return (
    <div className="max-w-lg">
      <Link
        href="/super-admin/organizations"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to organizations
      </Link>

      <h1 className="mb-1 text-xl font-semibold">New organization</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Create an organization and invite its admin. They'll receive an email to set up their account.
      </p>

      <CreateOrgForm />
    </div>
  );
}
