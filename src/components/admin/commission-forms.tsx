"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { saveCommissionRule, setSetting } from "@/features/admin/actions";

export function CommissionForms({
  globalRate,
  businesses,
  categories,
}: {
  globalRate: number;
  businesses: { id: string; trade_name: string }[];
  categories: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rate, setRate] = useState(String(globalRate * 100));
  const today = new Date().toISOString().slice(0, 10);
  const [rule, setRule] = useState({ target: "", ratePercent: "", validFrom: today, validTo: "", note: "" });

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, message: string, after?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) return void toast.error(result.error);
      toast.success(message);
      after?.();
      router.refresh();
    });

  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader title="Tasa global" />
        <CardBody>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => setSetting("commission_rate", Number(rate) / 100), "Comisión global actualizada.");
            }}
          >
            <Field label="Porcentaje" htmlFor="global-rate" hint="Aplica a pedidos nuevos.">
              <Input id="global-rate" type="number" min={0} max={50} step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} />
            </Field>
            <Button type="submit" className="w-full" loading={pending}>
              Guardar
            </Button>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Nueva regla especial" />
        <CardBody>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const [kind, value] = rule.target.split(":");
              run(
                () =>
                  saveCommissionRule({
                    businessId: kind === "b" ? value : "",
                    categoryId: kind === "c" ? Number(value) : undefined,
                    ratePercent: rule.ratePercent,
                    validFrom: rule.validFrom,
                    validTo: rule.validTo,
                    note: rule.note,
                  }),
                "Regla creada.",
                () => setRule({ ...rule, target: "", ratePercent: "", note: "" }),
              );
            }}
          >
            <Field label="Aplica a" htmlFor="rule-target" className="sm:col-span-2">
              <Select id="rule-target" value={rule.target} onChange={(e) => setRule({ ...rule, target: e.target.value })}>
                <option value="" disabled>
                  Elige un negocio o categoría…
                </option>
                <optgroup label="Categorías">
                  {categories.map((c) => (
                    <option key={c.id} value={`c:${c.id}`}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Negocios">
                  {businesses.map((b) => (
                    <option key={b.id} value={`b:${b.id}`}>
                      {b.trade_name}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </Field>
            <Field label="Porcentaje" htmlFor="rule-rate">
              <Input id="rule-rate" type="number" min={0} max={50} step="0.1" value={rule.ratePercent} onChange={(e) => setRule({ ...rule, ratePercent: e.target.value })} />
            </Field>
            <Field label="Nota (opcional)" htmlFor="rule-note">
              <Input id="rule-note" value={rule.note} onChange={(e) => setRule({ ...rule, note: e.target.value })} placeholder="Promoción de lanzamiento" />
            </Field>
            <Field label="Desde" htmlFor="rule-from">
              <Input id="rule-from" type="date" value={rule.validFrom} onChange={(e) => setRule({ ...rule, validFrom: e.target.value })} />
            </Field>
            <Field label="Hasta (opcional)" htmlFor="rule-to">
              <Input id="rule-to" type="date" value={rule.validTo} onChange={(e) => setRule({ ...rule, validTo: e.target.value })} />
            </Field>
            <Button type="submit" className="sm:col-span-2" disabled={!rule.target || rule.ratePercent === ""} loading={pending}>
              Crear regla
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
