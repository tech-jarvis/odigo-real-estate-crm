"use client";

import { useState, useTransition } from "react";
import { UserPlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { linkContactToProject, unlinkContactFromProject } from "../actions";
import type { Contact } from "@/lib/types";

/**
 * Contacts linked to this project (project_contacts) — distinct from the
 * company's full contact list. Only linked contacts are eligible for AI
 * outreach (send_calendar_invite refuses unlinked contacts), so this is a
 * deliberate per-project selection, not just a mirror of the company page.
 */
export function ProjectContactsCard({
  projectId,
  linkedContacts,
  availableContacts,
  isAdmin,
}: {
  projectId: string;
  linkedContacts: Contact[];
  availableContacts: Contact[];
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");

  function handleLink() {
    if (!selected) return;
    startTransition(async () => {
      const res = await linkContactToProject(projectId, selected);
      if (res.error) {
        toast.error("Couldn't link contact", { description: res.error });
        return;
      }
      toast.success("Contact linked");
      setSelected("");
    });
  }

  function handleUnlink(contactId: string) {
    startTransition(async () => {
      const res = await unlinkContactFromProject(projectId, contactId);
      if (res.error) {
        toast.error("Couldn't unlink contact", { description: res.error });
        return;
      }
      toast.success("Contact unlinked");
    });
  }

  return (
    <div>
      {linkedContacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {availableContacts.length > 0
            ? "No contacts linked yet — pick one below."
            : "No contacts linked."}
        </p>
      ) : (
        <ul className="space-y-3">
          {linkedContacts.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              <Avatar name={c.name} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.role ?? "—"}
                  {c.email ? ` · ${c.email}` : ""}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleUnlink(c.id)}
                  disabled={pending}
                  title="Unlink from project"
                  className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && availableContacts.length > 0 && (
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Link a company contact…" />
            </SelectTrigger>
            <SelectContent>
              {availableContacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.role ? ` — ${c.role}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={handleLink}
            disabled={!selected || pending}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserPlus className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      )}

      {isAdmin && availableContacts.length === 0 && linkedContacts.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          This project&apos;s company has no contacts yet — add one from the
          client page first.
        </p>
      )}
    </div>
  );
}
