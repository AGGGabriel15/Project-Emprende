"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form-controls";
import { setSetting } from "@/features/admin/actions";

type Values = {
  first_products_review: number;
  informal_max_active_orders: number;
  informal_monthly_cap_minor: number;
  informal_trusted_after_orders: number;
  informal_trusted_max_active_orders: number;
  informal_trusted_monthly_cap_minor: number;
  formal_max_active_orders: number;
};

// Los topes de ventas se editan en córdobas y se guardan en centavos.
const FIELDS: { key: keyof Values; label: string; hint?: string; money?: boolean }[] = [
  { key: "first_products_review", label: "Productos revisados por la administración", hint: "Los primeros N de cada negocio." },
  { key: "formal_max_active_orders", label: "Negocio formal · pedidos en curso" },
  { key: "informal_max_active_orders", label: "Emprendedor nuevo · pedidos en curso" },
  { key: "informal_monthly_cap_minor", label: "Emprendedor nuevo · tope de ventas al mes (C$)", money: true },
  { key: "informal_trusted_after_orders", label: "Pedidos completados para subir de límite", hint: "Sin incidentes." },
  { key: "informal_trusted_max_active_orders", label: "Emprendedor con historial · pedidos en curso" },
  { key: "informal_trusted_monthly_cap_minor", label: "Emprendedor con historial · tope al mes (C$)", money: true },
];

export function LimitsForm({ values: initial }: { values: Values }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      FIELDS.map(({ key, money }) => [key, String(money ? initial[key] / 100 : initial[key])]),
    ) as Record<keyof Values, string>,
  );

  function save() {
    startTransition(async () => {
      for (const { key, money } of FIELDS) {
        const number = Number(values[key]);
        if (!Number.isFinite(number) || number < 0) return void toast.error("Revisa los valores: deben ser positivos.");
        const stored = money ? Math.round(number * 100) : Math.round(number);
        if (stored === initial[key]) continue;
        const result = await setSetting(key, stored);
        if (!result.ok) return void toast.error(result.error);
      }
      toast.success("Límites guardados.");
      router.refresh();
    });
  }

  return (
    <Card className="mt-6">
      <CardHeader
        title="Límites por nivel de vendedor"
        description="Controlan cuánto puede vender cada negocio mientras construye historial."
      />
      <CardBody className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(({ key, label, hint }) => (
          <Field key={key} label={label} htmlFor={`limit-${key}`} hint={hint}>
            <Input
              id={`limit-${key}`}
              type="number"
              min={0}
              value={values[key]}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            />
          </Field>
        ))}
        <div className="sm:col-span-2">
          <Button onClick={save} loading={pending}>
            Guardar límites
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
