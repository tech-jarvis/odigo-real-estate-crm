"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { toast } from "sonner";
import { KanbanSquare } from "lucide-react";
import { STAGES, STAGE_META } from "@/lib/types";
import type { ProjectWithRelations, ProjectStage } from "@/lib/types";
import { formatCurrencyCompact } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { ProjectCard } from "./project-card";
import { moveProjectStage } from "./actions";
import { cn } from "@/lib/utils";

export function PipelineBoard({
  projects: initial,
  isAdmin,
}: {
  projects: ProjectWithRelations[];
  isAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const [projects, setProjects] = useState(initial);
  const [, startTransition] = useTransition();

  // Sync local state when the server sends refreshed props (e.g. after project creation).
  useEffect(() => { setProjects(initial); }, [initial]);

  const byStage = (stage: ProjectStage) =>
    projects.filter((p) => p.stage === stage);

  function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    )
      return;

    const newStage = destination.droppableId as ProjectStage;
    const moved = projects.find((p) => p.id === draggableId);
    if (!moved || moved.stage === newStage) {
      // Reorder within same column is purely visual; keep it simple.
      if (moved && moved.stage === newStage) return;
      return;
    }

    const prevStage = moved.stage;
    // Optimistic update.
    setProjects((prev) =>
      prev.map((p) => (p.id === draggableId ? { ...p, stage: newStage } : p))
    );

    startTransition(async () => {
      const { error } = await moveProjectStage(draggableId, newStage);
      if (error) {
        // Roll back.
        setProjects((prev) =>
          prev.map((p) =>
            p.id === draggableId ? { ...p, stage: prevStage } : p
          )
        );
        toast.error("Couldn't move project", { description: error });
      } else {
        toast.success(
          `Moved to ${STAGE_META[newStage].label}`,
          { description: moved.name }
        );
        queryClient.invalidateQueries({ queryKey: ["projects"] });
      }
    });
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={KanbanSquare}
        title="No projects yet"
        description={
          isAdmin
            ? "Create your first project to start tracking the pipeline."
            : "There are no active projects to show right now."
        }
      />
    );
  }

  const board = (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {STAGES.map((stage) => {
        const items = byStage(stage);
        const total = items.reduce((s, p) => s + Number(p.project_value), 0);
        const meta = STAGE_META[stage];
        return (
          <div key={stage} className="flex w-72 shrink-0 flex-col">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
                <span className="text-sm font-medium">{meta.label}</span>
                <span className="rounded-full bg-secondary px-1.5 text-xs text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {formatCurrencyCompact(total)}
              </span>
            </div>

            <Droppable
              droppableId={stage}
              isDropDisabled={!isAdmin}
              isCombineEnabled={false}
              ignoreContainerClipping={false}
            >
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "flex min-h-[120px] flex-1 flex-col gap-2.5 rounded-lg border border-transparent p-1.5 transition-colors",
                    snapshot.isDraggingOver &&
                      "border-gold/30 bg-gold/[0.04]"
                  )}
                >
                  {items.length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground/70">
                      Nothing here
                    </p>
                  )}
                  {items.map((project, index) => (
                    <Draggable
                      key={project.id}
                      draggableId={project.id}
                      index={index}
                      isDragDisabled={!isAdmin}
                    >
                      {(prov, snap) => (
                        <div
                          ref={prov.innerRef}
                          {...(prov.draggableProps as React.HTMLAttributes<HTMLDivElement>)}
                          {...prov.dragHandleProps}
                          className={cn(
                            "outline-none",
                            snap.isDragging && "rotate-[0.5deg]"
                          )}
                        >
                          <ProjectCard
                            project={project}
                            dragging={snap.isDragging}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        );
      })}
    </div>
  );

  return <DragDropContext onDragEnd={onDragEnd}>{board}</DragDropContext>;
}
