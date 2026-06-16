"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteContact } from "../actions";

export function DeleteContactButton({
  id,
  companyId,
}: {
  id: string;
  companyId: string;
}) {
  const [pending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      const res = await deleteContact(id, companyId);
      if (res.error) {
        toast.error("Delete failed", { description: res.error });
        return;
      }
      toast.success("Contact removed");
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground hover:text-destructive"
      onClick={handle}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
