import type { Metadata } from "next";
import { DashboardView } from "./dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Pipeline value by stage, deals closing soon, and recent activity across every Odigo project.",
};

// No Supabase calls here — RSC is fast (just component tree).
// Auth state comes from RoleContext (set once in app layout).
// Data is fetched client-side by DashboardView via React Query.
export default function DashboardPage() {
  return <DashboardView />;
}
