"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form-controls";
import { generatePayouts } from "@/features/admin/actions";

function lastMonth() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function GeneratePayoutsForm() {
  const router = useRouter();
  const [range, setRange] = useState(lastMonth);
  const [pending, startTransition] = useTransition();
  return (
    <Card className="p-5">
      <form
        className="flex flex-wrap items-end gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const result = await generatePayouts(range.start, range.end);
            if (!result.ok) return void toast.error(result.error);
            toast.success(result.data ? `${result.data} liquidaciones generadas.` : "No había pedidos nuevos para ese período.");
            router.refresh();
          });
        }}
      >
        <Field label="Desde" htmlFor="payout-start">
          <Input id="payout-start" type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} />
        </Field>
        <Field label="Hasta" htmlFor="payout-end">
          <Input id="payout-end" type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} />
        </Field>
        <Button type="submit" loading={pending}>
          Generar liquidaciones
        </Button>
      </form>
    </Card>
  );
}
