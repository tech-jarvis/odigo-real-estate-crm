import type { Metadata } from "next";
import { CompaniesHeader } from "./companies-header";
import { CompanyList } from "./company-list";

export const metadata: Metadata = {
  title: "Clients",
  description: "Every client company, their contacts, and linked projects.",
};

// No Supabase calls here — RSC is fast (just component tree).
// Auth state comes from RoleContext (set once in app layout).
// Data is fetched client-side by CompanyList via React Query.
export default function CompaniesPage() {
  return (
    <>
      <CompaniesHeader />
      <CompanyList />
    </>
  );
}
