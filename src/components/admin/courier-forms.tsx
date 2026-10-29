"use client";

import { Bike, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { PhoneInput } from "@/components/ui/masked-inputs";
import { Switch } from "@/components/ui/switch";
import { assignShipment, createCourier, setCourierActive } from "@/features/admin/actions";
import { VEHICLE_LABEL } from "@/features/couriers/status";

/** Alta de un repartidor (empleado). Comparte la contraseña temporal por un canal seguro. */
export function CreateCourierButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", vehicle: "moto", plate: "", password: "" });
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <UserPlus /> Nuevo repartidor
      </Button>
      {open && (
        <DialogContent title="Nuevo repartidor" description="Crea su cuenta. Inicia sesión con este correo y la contraseña temporal; luego puede cambiarla en su perfil.">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const result = await createCourier(form);
                if (!result.ok) return void toast.error(result.error);
                toast.success("Repartidor creado.");
                setOpen(false);
                setForm({ fullName: "", email: "", phone: "", vehicle: "moto", plate: "", password: "" });
                router.refresh();
              });
            }}
          >
            <Field label="Nombre completo" htmlFor="courier-name">
              <Input id="courier-name" value={form.fullName} onChange={set("fullName")} />
            </Field>
            <Field label="Correo" htmlFor="courier-email">
              <Input id="courier-email" type="email" value={form.email} onChange={set("email")} />
            </Field>
            <Field label="Teléfono" htmlFor="courier-phone">
              <PhoneInput id="courier-phone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vehículo" htmlFor="courier-vehicle">
                <Select id="courier-vehicle" value={form.vehicle} onChange={set("vehicle")}>
                  {Object.entries(VEHICLE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Placa" htmlFor="courier-plate">
                <Input id="courier-plate" value={form.plate} onChange={set("plate")} placeholder="M 123-456" />
              </Field>
            </div>
            <Field label="Contraseña temporal" htmlFor="courier-password">
              <Input id="courier-password" type="text" autoComplete="off" value={form.password} onChange={set("password")} />
            </Field>
            <Button type="submit" className="w-full" loading={pending}>
              Crear repartidor
            </Button>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

export function CourierActiveSwitch({ userId, active }: { userId: string; active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2 text-sm">
      <Switch
        checked={active}
        disabled={pending}
        aria-label="Cuenta activa"
        onCheckedChange={(next) =>
          startTransition(async () => {
            const result = await setCourierActive(userId, next);
            if (!result.ok) return void toast.error(result.error);
            toast.success(next ? "Repartidor activado." : "Repartidor desactivado.");
            router.refresh();
          })
        }
      />
      <span className={active ? "" : "text-destructive"}>{active ? "Activo" : "Inactivo"}</span>
    </div>
  );
}

export type CourierOption = { id: string; name: string; online: boolean; active: number };

/** Asigna o reasigna el envío a un repartidor (los que están en turno primero). */
export function AssignCourierForm({
  orderId,
  couriers,
  current,
}: {
  orderId: string;
  couriers: CourierOption[];
  current?: string | null;
}) {
  const router = useRouter();
  const options = couriers.filter((c) => c.id !== current);
  const [courierId, setCourierId] = useState(options[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  if (options.length === 0) return <span className="text-xs text-muted-foreground">Sin repartidores activos</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select aria-label="Repartidor" className="h-9 w-56" value={courierId} onChange={(e) => setCourierId(e.target.value)}>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.online ? "● " : "○ "}
            {c.name} · {c.active} activa(s)
          </option>
        ))}
      </Select>
      <Button
        size="sm"
        variant={current ? "outline" : "primary"}
        loading={pending}
        disabled={!courierId}
        onClick={() =>
          startTransition(async () => {
            const result = await assignShipment({ orderId, courierId });
            if (!result.ok) return void toast.error(result.error);
            toast.success(current ? "Envío reasignado." : "Repartidor asignado.");
            router.refresh();
          })
        }
      >
        <Bike /> {current ? "Reasignar" : "Asignar"}
      </Button>
    </div>
  );
}
