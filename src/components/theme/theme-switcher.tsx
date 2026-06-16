"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme, type Accent } from "./theme-provider";

const ACCENTS: { id: Accent; label: string; hsl: string }[] = [
  { id: "gold",    label: "Gold",    hsl: "38 62% 56%"  },
  { id: "blue",    label: "Blue",    hsl: "215 65% 58%" },
  { id: "emerald", label: "Emerald", hsl: "158 55% 47%" },
  { id: "rose",    label: "Rose",    hsl: "346 68% 60%" },
  { id: "violet",  label: "Violet",  hsl: "262 62% 62%" },
];

export function ThemeSwitcher() {
  const { theme, accent, setTheme, setAccent } = useTheme();

  return (
    <div className="space-y-2.5 px-1 py-1">
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Theme</p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs font-medium transition-colors focus:outline-none",
              theme === "dark"
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
            )}
          >
            <Moon className="h-3 w-3" /> Dark
          </button>
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs font-medium transition-colors focus:outline-none",
              theme === "light"
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
            )}
          >
            <Sun className="h-3 w-3" /> Light
          </button>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Accent</p>
        <div className="flex gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAccent(a.id)}
              title={a.label}
              className={cn(
                "h-5 w-5 rounded-full border-2 transition-all",
                accent === a.id
                  ? "scale-125 border-foreground/60"
                  : "border-transparent hover:scale-110 hover:border-foreground/30"
              )}
              style={{ background: `hsl(${a.hsl})` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
