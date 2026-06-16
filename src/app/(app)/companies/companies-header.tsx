"use client";

import { useRole } from "@/components/shared/role-context";
import { PageHeader } from "@/components/shared/page-header";
import { CompanyFormDialog } from "./company-form-dialog";

export function CompaniesHeader() {
  const { isAdmin } = useRole();
  return (
    <PageHeader
      title="Clients"
      description="Companies, their contacts, and linked projects."
      action={isAdmin ? <CompanyFormDialog mode="create" /> : undefined}
    />
  );
}
