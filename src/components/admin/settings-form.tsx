"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form-controls";
import { PhoneInput } from "@/components/ui/masked-inputs";
import { setSetting } from "@/features/admin/actions";

export function SettingsForm({
  settings,
  integrations,
}: {
  settings: { commissionRate: number; pendingMinutes: number; supportEmail: string; supportWhatsapp: string };
  integrations: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({
    commission: String(settings.commissionRate * 100),
    minutes: String(settings.pendingMinutes),
    email: settings.supportEmail,
    whatsapp: settings.supportWhatsapp,
  });

  function save() {
    startTransition(async () => {
      const updates: [string, unknown][] = [
        ["commission_rate", Number(values.commission) / 100],
        ["pending_payment_minutes", Number(values.minutes)],
        ["support_email", values.email],
        ["support_whatsapp", values.whatsapp],
      ];
      for (const [key, value] of updates) {
        const result = await setSetting(key, value);
        if (!result.ok) return void toast.error(result.error);
      }
      toast.success("Configuración guardada.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Parámetros" description="Cada cambio queda registrado en auditoría." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Comisión global (%)" htmlFor="s-commission">
            <Input id="s-commission" type="number" step="0.1" min={0} max={50} value={values.commission} onChange={(e) => setValues({ ...values, commission: e.target.value })} />
          </Field>
          <Field label="Minutos para pagar un pedido" htmlFor="s-minutes" hint="Luego el cron lo cancela.">
            <Input id="s-minutes" type="number" min={30} max={1440} value={values.minutes} onChange={(e) => setValues({ ...values, minutes: e.target.value })} />
          </Field>
          <Field label="Correo de soporte" htmlFor="s-email">
            <Input id="s-email" type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} />
          </Field>
          <Field label="WhatsApp de soporte" htmlFor="s-wa">
            <PhoneInput id="s-wa" value={values.whatsapp} onChange={(whatsapp) => setValues({ ...values, whatsapp })} />
          </Field>
          <div className="sm:col-span-2">
            <Button onClick={save} loading={pending}>
              Guardar configuración
            </Button>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Integraciones" description="Se configuran con variables de entorno." />
        <CardBody>
          <dl className="space-y-2 text-sm">
            {Object.entries({ Pagos: integrations.payments, Correo: integrations.email, Sentry: integrations.sentry }).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}
