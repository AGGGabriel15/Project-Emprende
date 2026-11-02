"use client";

import { Check, Circle, Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";
import { PASSWORD_RULES } from "@/lib/validations/auth";

/** Campo de contraseña con botón de ojo para mostrarla u ocultarla. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-11", className)} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 grid w-11 cursor-pointer place-items-center rounded-r-xl text-muted-foreground transition hover:text-foreground focus-visible:text-primary focus-visible:outline-none"
      >
        {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
}

/** Requisitos de la contraseña marcados en vivo mientras se escribe. */
export function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Requisitos de la contraseña">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value);
        return (
          <li key={rule.label} className={cn("flex items-center gap-1.5", ok ? "text-success" : "text-muted-foreground")}>
            {ok ? <Check className="size-3.5" /> : <Circle className="size-3" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
