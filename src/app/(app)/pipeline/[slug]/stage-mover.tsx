"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STAGES, STAGE_META } from "@/lib/types";
import type { ProjectStage } from "@/lib/types";
import { moveProjectStage } from "../actions";

export function StageMover({
  projectId,
  stage,
}: {
  projectId: string;
  stage: ProjectStage;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    const nextStage = next as ProjectStage;
    if (nextStage === stage) return;
    startTransition(async () => {
      const res = await moveProjectStage(projectId, nextStage);
      if (res.error) {
        toast.error("Couldn't change stage", { description: res.error });
        return;
      }
      toast.success(`Moved to ${STAGE_META[nextStage].label}`);
      router.refresh();
    });
  }

  return (
    <Select value={stage} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="h-8 w-[130px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STAGES.map((s) => (
          <SelectItem key={s} value={s}>
            {STAGE_META[s].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
