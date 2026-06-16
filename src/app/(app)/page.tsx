import { DashboardView } from "./dashboard-view";

// No Supabase calls here — RSC is fast (just component tree).
// Auth state comes from RoleContext (set once in app layout).
// Data is fetched client-side by DashboardView via React Query.
export default function DashboardPage() {
  return <DashboardView />;
}
