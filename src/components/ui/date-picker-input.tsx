"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerInputProps {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  className?: string;
  minDate?: Date;
  onChange?: (date: Date | undefined) => void;
}

export function DatePickerInput({
  name,
  defaultValue,
  placeholder = "Pick a date",
  className,
  minDate,
  onChange,
}: DatePickerInputProps) {
  const [date, setDate] = React.useState<Date | undefined>(
    defaultValue ? parseISO(defaultValue) : undefined
  );
  const [open, setOpen] = React.useState(false);

  const formatted = date ? format(date, "MMM d, yyyy") : undefined;
  const isoValue = date ? format(date, "yyyy-MM-dd") : "";

  function handleSelect(d: Date | undefined) {
    setDate(d);
    setOpen(false);
    onChange?.(d);
  }

  return (
    <div className={cn("relative", className)}>
      <input type="hidden" name={name} value={isoValue} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start gap-2 text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 opacity-60" />
            {formatted ?? placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            disabled={minDate ? { before: minDate } : undefined}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
