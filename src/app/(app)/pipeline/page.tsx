import type { Metadata } from "next";
import { PipelineView } from "./pipeline-view";

type PipelineSearchParams = Promise<{ show?: string }>;

function resolveView(show: string | undefined) {
  return show === "trash" ? "trash" : show === "archived" ? "archived" : "active";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: PipelineSearchParams;
}): Promise<Metadata> {
  const { show } = await searchParams;
  const view = resolveView(show);
  const titles = { active: "Pipeline", archived: "Archived Projects", trash: "Trash" } as const;
  const descriptions = {
    active: "Every active lead, proposal, and in-progress project on the board.",
    archived: "Projects that have been archived out of the active pipeline.",
    trash: "Deleted projects, recoverable for 15 days before permanent removal.",
  } as const;
  return { title: titles[view], description: descriptions[view] };
}

// No Supabase calls here — RSC is fast (just URL parsing).
// Data is fetched client-side by PipelineView via React Query, which caches
// it in the browser singleton. Navigating back within staleTime (5 min) renders
// instantly from cache with no network round-trip and no skeleton.
export default async function PipelinePage({
  searchParams,
}: {
  searchParams: PipelineSearchParams;
}) {
  const { show } = await searchParams;
  const view = resolveView(show);
  return <PipelineView view={view} />;
}
