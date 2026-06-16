"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUploadZone } from "@/components/ui/file-preview";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITY_META } from "@/lib/types";
import type { ActivityType } from "@/lib/types";
import { addActivity } from "@/app/(app)/pipeline/[slug]/activity-actions";

const TYPES: ActivityType[] = [
  "note",
  "status_change",
  "file_reference",
  "call_summary",
];

export function AddActivityForm({ projectId }: { projectId: string }) {
  const [type, setType] = useState<ActivityType>("note");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handle(formData: FormData) {
    formData.set("type", type);

    startTransition(async () => {
      if (type === "file_reference") {
        if (!selectedFile) {
          toast.error("Please select a file first");
          return;
        }

        const supabase = createClient();
        const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${projectId}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("project-files")
          .upload(path, selectedFile);

        if (uploadError) {
          toast.error("Upload failed", { description: uploadError.message });
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("project-files").getPublicUrl(path);

        formData.set("file_url", publicUrl);
        formData.set("file_name", selectedFile.name);
      }

      const res = await addActivity(projectId, formData);
      if (res.error) {
        toast.error("Couldn't add entry", { description: res.error });
        return;
      }

      formRef.current?.reset();
      setType("note");
      setSelectedFile(null);
      toast.success("Entry added");
    });
  }

  return (
    <form ref={formRef} action={handle} className="space-y-2.5">
      {type === "file_reference" ? (
        <>
          <FileUploadZone file={selectedFile} onFileChange={setSelectedFile} />
          <Textarea
            name="body"
            placeholder="Optional note about this file…"
            className="min-h-[52px]"
          />
        </>
      ) : (
        <Textarea
          name="body"
          required
          placeholder="Add a note, call summary, or status update…"
          className="min-h-[64px]"
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v as ActivityType);
            setSelectedFile(null);
          }}
        >
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {ACTIVITY_META[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {type === "file_reference" ? "Upload & save" : "Add entry"}
        </Button>
      </div>
    </form>
  );
}
