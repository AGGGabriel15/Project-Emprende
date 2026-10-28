"use client";

import { ChevronDown } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";
import {
  callingCode,
  countryOptions,
  detectFromInternational,
  formatCedula,
  formatNational,
  joinPhone,
  maxNationalDigits,
  splitPhone,
  type CountryCode,
} from "@/lib/phone";
import { cn } from "@/lib/utils";
import { Input } from "./form-controls";

/**
 * Teléfono con selector de país (+505 por defecto). Emite E.164 ("+50573123134")
 * o "" si está vacío; muestra el número con el formato del país mientras se escribe.
 */
export function PhoneInput({
  id,
  name,
  value,
  onChange,
  onBlur,
  invalid,
  disabled,
  className,
}: {
  id?: string;
  name?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [phone, setPhone] = useState(() => splitPhone(value));
  const formatted = formatNational(phone.country, phone.digits);

  function update(next: { country: CountryCode; digits: string }) {
    setPhone(next);
    onChange(joinPhone(next.country, next.digits));
  }

  return (
    <div
      className={cn(
        "flex h-11 w-full overflow-hidden rounded-xl border border-input bg-card shadow-xs transition focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20",
        invalid && "border-destructive focus-within:border-destructive focus-within:ring-destructive/15",
        disabled && "border-border bg-muted",
        className,
      )}
    >
      <label className="relative flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-border bg-muted/70 pr-2.5 pl-3 text-sm font-semibold hover:bg-primary-soft">
        <span className="text-[11px] font-medium text-muted-foreground">{phone.country}</span>
        <span className="tabular-nums">{callingCode(phone.country)}</span>
        <ChevronDown className="size-3.5 text-primary" aria-hidden />
        <select
          aria-label="País del teléfono"
          value={phone.country}
          disabled={disabled}
          onChange={(event) => {
            const country = event.target.value as CountryCode;
            update({ country, digits: phone.digits.slice(0, maxNationalDigits(country)) });
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {countryOptions().map((option) => (
            <option key={option.code} value={option.code} suppressHydrationWarning>
              {option.name} ({option.dial})
            </option>
          ))}
        </select>
      </label>
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        disabled={disabled}
        aria-invalid={invalid || undefined}
        placeholder={phone.country === "NI" ? "8888 8888" : "Número"}
        value={formatted}
        onBlur={onBlur}
        onChange={(event) => {
          const raw = event.target.value;
          // Número pegado con código de país: "+506 8312 3456".
          if (raw.trim().startsWith("+")) {
            const detected = detectFromInternational(raw);
            if (detected) return update(detected);
          }
          let digits = raw.replace(/\D/g, "");
          // Borrar un separador ("(", " ", "-") borra el dígito anterior.
          if (digits === phone.digits && raw.length < formatted.length) digits = digits.slice(0, -1);
          update({ country: phone.country, digits: digits.slice(0, maxNationalDigits(phone.country)) });
        }}
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground tabular-nums placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed"
      />
    </div>
  );
}

/** Cédula nicaragüense con guiones automáticos: 001-120307-1017X. */
export function CedulaInput({ onChange, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      inputMode="text"
      autoCapitalize="characters"
      autoComplete="off"
      maxLength={16}
      placeholder="001-010190-0001A"
      {...props}
      onChange={(event) => {
        event.target.value = formatCedula(event.target.value);
        onChange?.(event);
      }}
    />
  );
}
