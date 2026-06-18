"use client";

import { useState, useTransition } from "react";
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
import type { Contact } from "@/lib/types";
import { createContact, updateContact } from "../actions";

export function ContactFormDialog({
  companyId,
  mode,
  contact,
}: {
  companyId: string;
  mode: "create" | "edit";
  contact?: Contact;
}) {
  const [open, setOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handle(formData: FormData) {
    const name = (formData.get("name") as string) ?? "";
    if (/<[^>]*>/.test(name)) {
      const msg = "HTML tags are not allowed in the name.";
      setNameError(msg); toast.error("Invalid name", { description: msg }); return;
    }
    setNameError(null);

    const role = (formData.get("role") as string) ?? "";
    if (/<[^>]*>/.test(role)) {
      const msg = "HTML tags are not allowed in the role.";
      setRoleError(msg); toast.error("Invalid role", { description: msg }); return;
    }
    setRoleError(null);

    startTransition(async () => {
      const res =
        mode === "create"
          ? await createContact(companyId, formData)
          : await updateContact(contact!.id, companyId, formData);
      if (res.error) {
        toast.error("Save failed", { description: res.error });
        return;
      }
      toast.success(mode === "create" ? "Contact added" : "Contact updated");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setNameError(null); setRoleError(null); } }}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button variant="secondary" size="sm">
            <Plus className="h-4 w-4" /> Add contact
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add contact" : "Edit contact"}
          </DialogTitle>
          <DialogDescription>A person at this company.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); handle(new FormData(e.currentTarget)); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cname">Name</Label>
            <Input
              id="cname"
              name="name"
              required
              defaultValue={contact?.name}
              aria-invalid={!!nameError}
              className={nameError ? "border-destructive focus-visible:ring-destructive" : ""}
              onChange={() => nameError && setNameError(null)}
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="crole">Role</Label>
            <Input
              id="crole"
              name="role"
              defaultValue={contact?.role ?? ""}
              aria-invalid={!!roleError}
              className={roleError ? "border-destructive focus-visible:ring-destructive" : ""}
              onChange={() => roleError && setRoleError(null)}
            />
            {roleError && <p className="text-xs text-destructive">{roleError}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <PhoneInputField name="phone" defaultValue={contact?.phone ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cemail">Email</Label>
            <Input
              id="cemail"
              name="email"
              type="email"
              defaultValue={contact?.email ?? ""}
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
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
