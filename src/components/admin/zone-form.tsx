"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useGeo } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { savePlatformZone } from "@/features/admin/actions";

/** Alta o edición de una tarifa (si la zona ya existe, se actualiza). */
export function ZoneForm() {
  const router = useRouter();
  const geo = useGeo();
  const [values, setValues] = useState({ departmentId: "", municipalityId: "", fee: "", courierCost: "", estimatedDays: "1" });
  const [pending, startTransition] = useTransition();
  const municipalities = geo.municipalities.filter((m) => m.department_id === Number(values.departmentId));
  const margin = Number(values.fee) - Number(values.courierCost);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
      <Field label="Departamento" htmlFor="z-dept" className="lg:col-span-2">
        <Select id="z-dept" value={values.departmentId} onChange={(e) => setValues({ ...values, departmentId: e.target.value, municipalityId: "" })}>
          <option value="" disabled>
            Elige…
          </option>
          {geo.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Municipio" htmlFor="z-muni" className="lg:col-span-2">
        <Select id="z-muni" value={values.municipalityId} disabled={!values.departmentId} onChange={(e) => setValues({ ...values, municipalityId: e.target.value })}>
          <option value="">Todo el departamento</option>
          {municipalities.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Días" htmlFor="z-days">
        <Input id="z-days" type="number" min={0} max={15} value={values.estimatedDays} onChange={(e) => setValues({ ...values, estimatedDays: e.target.value })} />
      </Field>
      <span />
      <Field label="Cobra al cliente (C$)" htmlFor="z-fee" className="lg:col-span-2">
        <Input id="z-fee" type="number" min={0} value={values.fee} onChange={(e) => setValues({ ...values, fee: e.target.value })} />
      </Field>
      <Field
        label="Costo del repartidor (C$)"
        htmlFor="z-cost"
        className="lg:col-span-2"
        hint={values.fee && values.courierCost ? `Margen: C$ ${margin.toFixed(2)}` : undefined}
      >
        <Input id="z-cost" type="number" min={0} value={values.courierCost} onChange={(e) => setValues({ ...values, courierCost: e.target.value })} />
      </Field>
      <div className="lg:col-span-2">
        <Button
          className="w-full"
          loading={pending}
          disabled={!values.departmentId || values.fee === "" || values.courierCost === ""}
          onClick={() =>
            startTransition(async () => {
              const result = await savePlatformZone({ ...values, municipalityId: values.municipalityId || undefined });
              if (!result.ok) return void toast.error(result.error);
              toast.success("Tarifa guardada.");
              setValues({ departmentId: "", municipalityId: "", fee: "", courierCost: "", estimatedDays: "1" });
              router.refresh();
            })
          }
        >
          <Plus /> Guardar tarifa
        </Button>
      </div>
    </div>
  );
}
