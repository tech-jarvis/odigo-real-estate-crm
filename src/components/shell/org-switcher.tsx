"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
import { switchOrg } from "@/lib/actions/orgs";
import type { OrgMembershipWithOrg } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function OrgSwitcher({
  memberships,
  currentOrgId,
}: {
  memberships: OrgMembershipWithOrg[];
  currentOrgId: string | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const current = memberships.find((m) => m.org_id === currentOrgId);
  const orgName = current?.organizations?.name ?? "No organization";

  function handleSwitch(orgId: string) {
    if (orgId === currentOrgId) return;
    startTransition(async () => {
      try {
        await switchOrg(orgId);
        // Every org's companies/projects/dashboard/etc. share the same
        // React Query keys today (none are org-scoped) — nothing else
        // will notice the org changed unless we drop the cache here.
        // router.refresh() alone only re-renders Server Components; it
        // never touches this client-side cache.
        queryClient.clear();
        router.refresh();
      } catch (err) {
        toast.error((err as Error).message);
      }
    });
  }

  if (memberships.length <= 1) {
    return (
      <div
        className="mt-2 flex w-full items-center gap-1.5 rounded-md border border-border bg-secondary/30 px-2.5 py-1.5"
        title={orgName}
      >
        <span className="flex-1 truncate text-xs font-medium text-foreground/80">{orgName}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="mt-2 flex w-full items-center gap-1.5 rounded-md border border-border bg-secondary/30 px-2.5 py-1.5 text-left transition-colors hover:bg-secondary/60 disabled:opacity-60"
          title={orgName}
          disabled={isPending}
        >
          <span className="flex-1 truncate text-xs font-medium text-foreground/80">{orgName}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.org_id}
            className="cursor-pointer justify-between"
            onClick={() => handleSwitch(m.org_id)}
          >
            <span className="truncate">{m.organizations?.name ?? m.org_id}</span>
            {m.org_id === currentOrgId && <Check className="h-3.5 w-3.5 shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
