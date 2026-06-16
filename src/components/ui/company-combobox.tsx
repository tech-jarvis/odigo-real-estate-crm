"use client";

import { useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "@/lib/utils";

export interface CompanyOption {
  id: string;
  name: string;
}

interface CompanyComboboxProps {
  companies: CompanyOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

export function CompanyCombobox({
  companies,
  value,
  onChange,
  placeholder = "Select a company",
}: CompanyComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = companies.find((c) => c.id === value);

  const filtered = query.trim()
    ? companies.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase())
      )
    : companies;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background/40 px-3 py-2 text-sm shadow-sm transition-colors hover:bg-accent/50 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.name : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            placeholder="Search companies…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Results list */}
        <div className="max-h-52 overflow-y-auto p-1">
          {/* Clear option */}
          {value && (
            <button
              type="button"
              className="flex w-full items-center rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => { onChange(""); setQuery(""); setOpen(false); }}
            >
              Clear selection
            </button>
          )}

          {filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No companies found.
            </p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-foreground",
                  value === c.id && "bg-accent/60"
                )}
                onClick={() => {
                  onChange(c.id);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="truncate">{c.name}</span>
                {value === c.id && <Check className="ml-2 h-3.5 w-3.5 shrink-0" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
