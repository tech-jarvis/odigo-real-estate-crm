import { PipelineView } from "./pipeline-view";

// No Supabase calls here — RSC is fast (just URL parsing).
// Data is fetched client-side by PipelineView via React Query, which caches
// it in the browser singleton. Navigating back within staleTime (5 min) renders
// instantly from cache with no network round-trip and no skeleton.
export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const view =
    show === "trash" ? "trash" : show === "archived" ? "archived" : "active";
  return <PipelineView view={view} />;
}
