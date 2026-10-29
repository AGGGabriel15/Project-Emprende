"use client";

import { CalendarOff, Plus, Power, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { OpenBadge } from "@/components/catalog/open-badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/form-controls";
import { Switch } from "@/components/ui/switch";
import { addClosure, deleteClosure, saveHours, setOpenOverride } from "@/features/businesses/actions";
import { DAY_NAMES, type OpenState } from "@/features/businesses/hours";
import { cn, formatDate } from "@/lib/utils";
import type { BusinessClosure, BusinessHour } from "@/types/domain";

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function HoursEditor({
  hours,
  closures,
  override,
  state,
}: {
  hours: BusinessHour[];
  closures: BusinessClosure[];
  override: boolean | null;
  state: OpenState;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [days, setDays] = useState(() =>
    ORDER.map((dow) => {
      const h = hours.find((x) => x.day_of_week === dow);
      return {
        dayOfWeek: dow,
        opensAt: (h?.opens_at ?? "08:00").slice(0, 5),
        closesAt: (h?.closes_at ?? "17:00").slice(0, 5),
        isClosed: h ? h.is_closed : dow === 0,
      };
    }),
  );
  const [closure, setClosure] = useState({ date: "", reason: "" });

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, message: string, after?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) return void toast.error(result.error);
      toast.success(message);
      after?.();
      router.refresh();
    });

  const update = (index: number, patch: Partial<(typeof days)[number]>) =>
    setDays((current) => current.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  return (
    <div className="space-y-6">
      <Card className={cn("p-5", override === false && "border-destructive/40 bg-destructive-soft/40")}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Estado ahora</p>
            <OpenBadge state={state} className="mt-1 text-sm" />
          </div>
          {override === false ? (
            <Button onClick={() => run(() => setOpenOverride(null), "Volviste a tu horario normal.")} loading={pending}>
              <Power /> Reabrir (seguir horario)
            </Button>
          ) : (
            <Button variant="danger" onClick={() => run(() => setOpenOverride(false), "Negocio cerrado temporalmente.")} loading={pending}>
              <Power /> Cerrar ahora
            </Button>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          “Cerrar ahora” detiene los pagos de inmediato (por ejemplo, si te quedaste sin personal) hasta que reabras.
        </p>
      </Card>

      <Card>
        <CardHeader title="Horario semanal" />
        <ul className="divide-y">
          {days.map((day, index) => (
            <li key={day.dayOfWeek} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="w-24 font-medium">{DAY_NAMES[day.dayOfWeek]}</span>
              <Switch checked={!day.isClosed} onCheckedChange={(open) => update(index, { isClosed: !open })} />
              {day.isClosed ? (
                <span className="text-sm text-muted-foreground">Cerrado</span>
              ) : (
                <div className="flex items-center gap-2">
                  <Input type="time" value={day.opensAt} onChange={(e) => update(index, { opensAt: e.target.value })} className="h-9 w-32" aria-label={`Abre ${DAY_NAMES[day.dayOfWeek]}`} />
                  <span className="text-muted-foreground">a</span>
                  <Input type="time" value={day.closesAt} onChange={(e) => update(index, { closesAt: e.target.value })} className="h-9 w-32" aria-label={`Cierra ${DAY_NAMES[day.dayOfWeek]}`} />
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => {
              const monday = days[0];
              setDays((current) => current.map((d) => (d.dayOfWeek >= 1 && d.dayOfWeek <= 5 ? { ...monday, dayOfWeek: d.dayOfWeek } : d)));
            }}
          >
            Copiar lunes a días hábiles
          </Button>
          <Button onClick={() => run(() => saveHours(days), "Horario guardado.")} loading={pending}>
            Guardar horario
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Cierres especiales" description="Feriados, vacaciones o días sin atención." />
        <CardBody className="space-y-4">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => addClosure(closure), "Cierre agregado.", () => setClosure({ date: "", reason: "" }));
            }}
          >
            <Input type="date" value={closure.date} onChange={(e) => setClosure({ ...closure, date: e.target.value })} className="sm:w-44" aria-label="Fecha" />
            <Input value={closure.reason} onChange={(e) => setClosure({ ...closure, reason: e.target.value })} placeholder="Motivo (p. ej. Semana Santa)" aria-label="Motivo" />
            <Button type="submit" disabled={!closure.date || closure.reason.length < 3}>
              <Plus /> Agregar
            </Button>
          </form>
          {closures.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarOff className="size-4" /> No tienes cierres programados.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {closures.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span>
                    <strong>{formatDate(`${c.date}T12:00:00`, false)}</strong> · {c.reason}
                  </span>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive" aria-label="Eliminar" onClick={() => run(() => deleteClosure(c.id), "Cierre eliminado.")}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
