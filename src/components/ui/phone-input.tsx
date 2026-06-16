"use client";

import * as React from "react";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import type { Country, Value } from "react-phone-number-input";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const PhoneCtx = React.createContext({ invalid: false });

const PhoneNumberInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>((props, ref) => {
  const { invalid } = React.useContext(PhoneCtx);
  return (
    <Input
      {...props}
      ref={ref}
      className={cn(
        props.className,
        invalid && "border-destructive focus-visible:ring-destructive/50"
      )}
    />
  );
});
PhoneNumberInput.displayName = "PhoneNumberInput";

function CountrySelect({
  value,
  onChange,
  options,
  disabled,
  iconComponent: _icon,
}: {
  value: Country | undefined;
  onChange: (value: Country | undefined) => void;
  options: Array<{ value: Country | undefined; label: string; divider?: boolean }>;
  disabled?: boolean;
  iconComponent: React.ComponentType<{ country: Country; label: string }>;
}) {
  const { invalid } = React.useContext(PhoneCtx);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value as Country) || undefined)}
      disabled={disabled}
      title={selectedLabel}
      className={cn(
        "h-9 min-w-[5rem] max-w-[9rem] shrink-0 cursor-pointer rounded-md border border-input bg-background/40 px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/40 disabled:cursor-not-allowed disabled:opacity-50",
        invalid && "border-destructive focus-visible:ring-destructive/50"
      )}
    >
      {options.map(({ value: v, label, divider }) =>
        divider ? (
          <option key={`divider-${v ?? label}`} disabled>
            ──────
          </option>
        ) : (
          <option key={v ?? ""} value={v ?? ""}>
            {label}
          </option>
        )
      )}
    </select>
  );
}

interface PhoneInputFieldProps {
  name: string;
  defaultValue?: string | null;
  className?: string;
  onValidityChange?: (valid: boolean) => void;
}

export function PhoneInputField({
  name,
  defaultValue,
  className,
  onValidityChange,
}: PhoneInputFieldProps) {
  const [value, setValue] = React.useState<Value | undefined>(
    (defaultValue || undefined) as Value | undefined
  );

  const invalid = !!value && !isValidPhoneNumber(value);

  React.useEffect(() => {
    onValidityChange?.(!invalid);
  }, [invalid, onValidityChange]);

  return (
    <PhoneCtx.Provider value={{ invalid }}>
      <div className={cn("space-y-1", className)}>
        <input type="hidden" name={name} value={value ?? ""} />
        <PhoneInput
          defaultCountry="US"
          limitMaxLength
          value={value}
          onChange={setValue}
          inputComponent={PhoneNumberInput}
          countrySelectComponent={
            CountrySelect as React.ComponentType<{
              value: Country | undefined;
              onChange: (value: Country | undefined) => void;
              options: Array<{ value: Country | undefined; label: string; divider?: boolean }>;
              disabled?: boolean;
              iconComponent: React.ComponentType<{ country: Country; label: string }>;
            }>
          }
          className="flex items-center gap-1.5"
        />
        {invalid && (
          <p className="text-xs text-destructive">Enter a valid phone number.</p>
        )}
      </div>
    </PhoneCtx.Provider>
  );
}
