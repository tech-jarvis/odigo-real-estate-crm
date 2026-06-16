"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Loader2 } from "lucide-react";
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
import { PhoneInputField } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEGMENT_META } from "@/lib/types";
import type { Company, CompanySegment } from "@/lib/types";
import { createCompany, updateCompany } from "./actions";

const SEGMENTS: CompanySegment[] = ["residential", "commercial", "industrial"];

export function CompanyFormDialog({
  mode,
  company,
}: {
  mode: "create" | "edit";
  company?: Company;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [segment, setSegment] = useState<CompanySegment>(
    company?.segment ?? "residential"
  );
  const [phoneValid, setPhoneValid] = useState(true);
  const [pending, startTransition] = useTransition();

  function handle(formData: FormData) {
    if (!phoneValid) {
      toast.error("Invalid phone number", {
        description: "Please enter a valid phone number before saving.",
      });
      return;
    }
    formData.set("segment", segment);
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createCompany(formData)
          : await updateCompany(company!.id, formData);
      if (res.error) {
        toast.error("Save failed", { description: res.error });
        return;
      }
      toast.success(mode === "create" ? "Company added" : "Company updated");
      setOpen(false);
      // "companies" = lightweight list used in project form combobox
      // "companies-full" = list with contact/project counts on the clients page
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["companies-full"] });
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button>
            <Plus className="h-4 w-4" /> New company
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
            {mode === "create" ? "New company" : "Edit company"}
          </DialogTitle>
          <DialogDescription>
            Client or subcontractor company record.
          </DialogDescription>
        </DialogHeader>

        <form action={handle} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required defaultValue={company?.name} />
            </div>
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label>Segment</Label>
              <Select
                value={segment}
                onValueChange={(v) => setSegment(v as CompanySegment)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SEGMENT_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" defaultValue={company?.address ?? ""} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="primary_contact">Primary contact</Label>
            <Input
              id="primary_contact"
              name="primary_contact"
              defaultValue={company?.primary_contact ?? ""}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Phone</Label>
            <PhoneInputField
              name="phone"
              defaultValue={company?.phone ?? ""}
              onValidityChange={setPhoneValid}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={company?.email ?? ""}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={company?.notes ?? ""} />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create" ? "Add company" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
