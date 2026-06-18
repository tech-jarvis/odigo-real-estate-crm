"use client";

import { useState } from "react";
import { Download, Eye, FileText, ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

type FileKind = "image" | "pdf" | "other";

function isSafeUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function detectKind(url: string): FileKind {
  const clean = url.split("?")[0].toLowerCase();
  const ext = clean.split(".").pop() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif"].includes(ext))
    return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}

function displayName(url: string): string {
  try {
    const segment = decodeURIComponent(url.split("?")[0].split("/").pop() ?? "file");
    // Strip leading UUID prefix: "<uuid>-originalname.ext"
    return segment.replace(/^[0-9a-f-]{36}-/i, "");
  } catch {
    return "file";
  }
}

export function FilePreview({ url, label }: { url: string; label?: string }) {
  const [open, setOpen] = useState(false);

  if (!isSafeUrl(url)) return null;

  const kind = detectKind(url);
  const name = label || displayName(url);

  if (kind === "image") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 block max-w-xs overflow-hidden rounded-md border border-border transition-opacity hover:opacity-80"
          title="Click to expand"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={name}
            className="max-h-40 w-full object-cover"
          />
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl p-4">
            <DialogTitle className="text-sm font-medium">{name}</DialogTitle>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={name} className="mt-2 w-full rounded-md" />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (kind === "pdf") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2.5 py-1.5 text-xs text-foreground/80 transition-colors hover:bg-secondary"
        >
          <Eye className="h-3.5 w-3.5 text-sky-400" />
          {name}
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="flex h-[85vh] max-w-4xl flex-col p-4">
            <DialogTitle className="shrink-0 text-sm font-medium">{name}</DialogTitle>
            <iframe
              src={url}
              title={name}
              sandbox="allow-scripts allow-same-origin"
              className="mt-2 min-h-0 flex-1 rounded-md border border-border"
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <a
      href={url}
      download={name}
      target="_blank"
      rel="noreferrer noopener"
      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2.5 py-1.5 text-xs text-foreground/80 transition-colors hover:bg-secondary"
    >
      <FileText className="h-3.5 w-3.5 text-sky-400" />
      {name}
      <Download className="ml-1 h-3 w-3 text-muted-foreground" />
    </a>
  );
}

export function FileUploadZone({
  file,
  onFileChange,
  accept,
}: {
  file: File | null;
  onFileChange: (f: File | null) => void;
  accept?: string;
}) {
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFileChange(dropped);
  }

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors ${
        dragging
          ? "border-sky-400 bg-sky-400/5"
          : file
          ? "border-border bg-secondary/30"
          : "border-border hover:border-muted-foreground/50"
      }`}
    >
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center gap-2 text-sm">
          <ImageIcon className="h-4 w-4 shrink-0 text-sky-400" />
          <span className="truncate max-w-[200px] font-medium">{file.name}</span>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onFileChange(null); }}
            className="ml-1 text-xs text-muted-foreground hover:text-destructive"
          >
            remove
          </button>
        </div>
      ) : (
        <>
          <FileText className="mb-1.5 h-5 w-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Drag & drop or <span className="text-foreground">click to browse</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/60">
            Images, PDFs, or any document up to 50 MB
          </p>
        </>
      )}
    </label>
  );
}
