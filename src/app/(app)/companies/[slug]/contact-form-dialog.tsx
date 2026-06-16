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
  const [pending, startTransition] = useTransition();

  function handle(formData: FormData) {
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
    <Dialog open={open} onOpenChange={setOpen}>
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
        <form action={handle} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cname">Name</Label>
            <Input id="cname" name="name" required defaultValue={contact?.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="crole">Role</Label>
            <Input id="crole" name="role" defaultValue={contact?.role ?? ""} />
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
