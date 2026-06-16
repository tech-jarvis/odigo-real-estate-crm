import { CompaniesHeader } from "./companies-header";
import { CompanyList } from "./company-list";

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
