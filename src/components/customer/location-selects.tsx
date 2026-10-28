"use client";

import { useMemo } from "react";
import { useGeo } from "@/components/providers";
import { Field, Select } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";

/** Selects encadenados Departamento → Ciudad (municipio). */
export function LocationSelects({
  departmentId,
  municipalityId,
  onChange,
  errors,
  idPrefix = "loc",
  allowAnyMunicipality,
  className,
}: {
  departmentId: number | null | undefined;
  municipalityId: number | null | undefined;
  onChange: (value: { departmentId: number; municipalityId: number }) => void;
  errors?: { departmentId?: string; municipalityId?: string };
  idPrefix?: string;
  /** Permite "Todo el departamento" (municipalityId = 0). */
  allowAnyMunicipality?: boolean;
  className?: string;
}) {
  const { departments, municipalities } = useGeo();
  const options = useMemo(
    () => municipalities.filter((m) => m.department_id === departmentId),
    [municipalities, departmentId],
  );

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      <Field
        label="Departamento"
        htmlFor={`${idPrefix}-department`}
        error={errors?.departmentId}
      >
        <Select
          id={`${idPrefix}-department`}
          value={departmentId ?? ""}
          aria-invalid={Boolean(errors?.departmentId) || undefined}
          onChange={(event) =>
            onChange({ departmentId: Number(event.target.value), municipalityId: 0 })
          }
        >
          <option value="" disabled>
            Elige…
          </option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Ciudad / municipio"
        htmlFor={`${idPrefix}-municipality`}
        error={errors?.municipalityId}
      >
        <Select
          id={`${idPrefix}-municipality`}
          value={municipalityId ?? (allowAnyMunicipality ? 0 : "")}
          disabled={!departmentId}
          aria-invalid={Boolean(errors?.municipalityId) || undefined}
          onChange={(event) =>
            onChange({
              departmentId: departmentId!,
              municipalityId: Number(event.target.value),
            })
          }
        >
          {allowAnyMunicipality ? (
            <option value={0}>Todo el departamento</option>
          ) : (
            <option value="" disabled>
              {departmentId ? "Elige…" : "Primero el departamento"}
            </option>
          )}
          {options.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
