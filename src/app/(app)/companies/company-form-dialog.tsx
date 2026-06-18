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
  const [nameError, setNameError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handle(formData: FormData) {
    const name = (formData.get("name") as string)?.trim();
    if (!name) {
      setNameError("Company name is required.");
      toast.error("Company name is required");
      return;
    }
    if (/<[^>]*>/.test(name)) {
      const msg = "HTML tags are not allowed. Remove < > characters from the name.";
      setNameError(msg);
      toast.error("Invalid company name", { description: msg });
      return;
    }
    setNameError(null);

    const address = (formData.get("address") as string) ?? "";
    if (/<[^>]*>/.test(address)) {
      const msg = "HTML tags are not allowed in the address.";
      setAddressError(msg); toast.error("Invalid address", { description: msg }); return;
    }
    setAddressError(null);

    const primaryContact = (formData.get("primary_contact") as string) ?? "";
    if (/<[^>]*>/.test(primaryContact)) {
      const msg = "HTML tags are not allowed in the primary contact.";
      setContactError(msg); toast.error("Invalid primary contact", { description: msg }); return;
    }
    setContactError(null);

    const notes = (formData.get("notes") as string) ?? "";
    if (/<[^>]*>/.test(notes)) {
      const msg = "HTML tags are not allowed in the notes.";
      setNotesError(msg); toast.error("Invalid notes", { description: msg }); return;
    }
    setNotesError(null);

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
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setNameError(null); setAddressError(null); setContactError(null); setNotesError(null); } }}>
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

        <form onSubmit={(e) => { e.preventDefault(); handle(new FormData(e.currentTarget)); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={company?.name}
                aria-invalid={!!nameError}
                className={nameError ? "border-destructive focus-visible:ring-destructive" : ""}
                onChange={() => nameError && setNameError(null)}
              />
              {nameError && (
                <p className="text-xs text-destructive">{nameError}</p>
              )}
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
            <Input
              id="address"
              name="address"
              defaultValue={company?.address ?? ""}
              aria-invalid={!!addressError}
              className={addressError ? "border-destructive focus-visible:ring-destructive" : ""}
              onChange={() => addressError && setAddressError(null)}
            />
            {addressError && <p className="text-xs text-destructive">{addressError}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="primary_contact">Primary contact</Label>
            <Input
              id="primary_contact"
              name="primary_contact"
              defaultValue={company?.primary_contact ?? ""}
              aria-invalid={!!contactError}
              className={contactError ? "border-destructive focus-visible:ring-destructive" : ""}
              onChange={() => contactError && setContactError(null)}
            />
            {contactError && <p className="text-xs text-destructive">{contactError}</p>}
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
            <Textarea
              id="notes"
              name="notes"
              defaultValue={company?.notes ?? ""}
              aria-invalid={!!notesError}
              className={notesError ? "border-destructive focus-visible:ring-destructive" : ""}
              onChange={() => notesError && setNotesError(null)}
            />
            {notesError && <p className="text-xs text-destructive">{notesError}</p>}
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
