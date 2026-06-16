"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { CompanyCombobox } from "@/components/ui/company-combobox";
import { STAGES, STAGE_META } from "@/lib/types";
import type { ProjectWithRelations } from "@/lib/types";
import { createProject, updateProject } from "./actions";

type Option = { id: string; name?: string | null; full_name?: string | null; email?: string | null };

interface Props {
  companies: { id: string; name: string }[];
  members: { id: string; full_name: string | null; email: string | null }[];
  mode: "create" | "edit";
  project?: ProjectWithRelations;
}

export function ProjectFormDialog({ companies, members, mode, project }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState(project?.stage ?? "lead");
  const [companyId, setCompanyId] = useState(project?.company_id ?? "");
  const [assignee, setAssignee] = useState(project?.assigned_to ?? "");
  const [pending, startTransition] = useTransition();

  function handle(formData: FormData) {
    formData.set("stage", stage);
    if (companyId) formData.set("company_id", companyId);
    if (assignee) formData.set("assigned_to", assignee);

    startTransition(async () => {
      const res =
        mode === "create"
          ? await createProject(formData)
          : await updateProject(project!.id, formData);
      if (res.error) {
        toast.error("Save failed", { description: res.error });
        return;
      }
      toast.success(mode === "create" ? "Project created" : "Project updated");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      router.refresh();
    });
  }

  const memberLabel = (m: Option) => m.full_name || m.email || "Unknown";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button>
            <Plus className="h-4 w-4" /> New project
          </Button>
        ) : (
          <Button variant="secondary" size="sm">
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New project" : "Edit project"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a project to the pipeline."
              : "Update the project details."}
          </DialogDescription>
        </DialogHeader>

        <form action={handle} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Project name</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={project?.name}
              placeholder="e.g. Hale Lakefront Residence"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as typeof stage)}>
                <SelectTrigger>
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project_value">Value ($)</Label>
              <Input
                id="project_value"
                name="project_value"
                type="number"
                min="0"
                step="1000"
                defaultValue={project?.project_value ?? ""}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Client company</Label>
            <CompanyCombobox
              companies={companies}
              value={companyId}
              onChange={setCompanyId}
              placeholder="Search companies…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <DatePickerInput
                name="start_date"
                defaultValue={project?.start_date}
                placeholder="Pick a date"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Est. end date</Label>
              <DatePickerInput
                name="estimated_end_date"
                defaultValue={project?.estimated_end_date}
                placeholder="Pick a date"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Assigned to</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {memberLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status_note">Status note</Label>
            <Textarea
              id="status_note"
              name="status_note"
              defaultValue={project?.status_note ?? ""}
              placeholder="Where things stand…"
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create" ? "Create project" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
