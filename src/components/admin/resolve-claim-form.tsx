"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { resolveClaim } from "@/features/admin/actions";
import { formatMoney } from "@/lib/utils";

const RESPONSIBLE = {
  business: "El negocio (se descuenta de su liquidación y suma una falta)",
  courier: "El repartidor (lo asume Catarina Market)",
  platform: "Catarina Market (sale de la reserva)",
};

/** Decide un reclamo con monto y responsable; la nota la ven el cliente y el negocio. */
export function ResolveClaimForm({ claimId, refundable, subtotal }: { claimId: string; refundable: number; subtotal: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(Math.min(subtotal, refundable) / 100));
  const [responsible, setResponsible] = useState<keyof typeof RESPONSIBLE>("business");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function decide(approve: boolean) {
    startTransition(async () => {
      const result = await resolveClaim({ claimId, approve, refund: approve ? amount : undefined, responsible, note });
      if (!result.ok) return void toast.error(result.error);
      toast.success(approve ? "Reclamo aprobado: reembolso en proceso." : "Reclamo rechazado: se libera el pago al negocio.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-xl bg-muted/60 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`Reembolso (máx. ${formatMoney(refundable)})`} htmlFor={`refund-${claimId}`}>
          <Input id={`refund-${claimId}`} type="number" min={0} max={refundable / 100} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Responsable" htmlFor={`resp-${claimId}`}>
          <Select id={`resp-${claimId}`} value={responsible} onChange={(e) => setResponsible(e.target.value as keyof typeof RESPONSIBLE)}>
            {Object.entries(RESPONSIBLE).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Decisión (la ven el cliente y el negocio)" htmlFor={`note-${claimId}`}>
        <Textarea id={`note-${claimId}`} rows={2} maxLength={600} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={pending} disabled={note.trim().length < 5 || Number(amount) <= 0} onClick={() => decide(true)}>
          <Check /> Aprobar y reembolsar
        </Button>
        <Button size="sm" variant="outline" loading={pending} disabled={note.trim().length < 5} onClick={() => decide(false)}>
          <X /> Rechazar
        </Button>
      </div>
    </div>
  );
}
