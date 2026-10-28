"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Bike, Inbox, MapPin, Phone, Store, Volume2, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/form-controls";
import { cancelOrder, transitionOrder } from "@/features/orders/actions";
import { nextVendorAction, ORDER_STATUS_LABEL } from "@/features/orders/status";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import type { OrderStatus } from "@/types/domain";
import type { BoardOrder } from "@/features/orders/queries";
import { formatPhone, phoneHref } from "@/lib/phone";

const COLUMNS: { status: OrderStatus; hint: string }[] = [
  { status: "preparing", hint: "Pagados, por preparar" },
  { status: "ready_for_pickup", hint: "Esperando al cliente" },
  { status: "on_the_way", hint: "En ruta de entrega" },
];

function minutesSince(iso: string | null) {
  return iso ? Math.round((Date.now() - new Date(iso).getTime()) / 60_000) : 0;
}

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.15);
    });
  } catch {
    // Sin audio disponible.
  }
}

export function OrdersBoard({
  businessId,
  active,
  recent,
  readOnly,
}: {
  businessId: string;
  active: BoardOrder[];
  recent: BoardOrder[];
  readOnly: boolean;
}) {
  const [sound, setSound] = useState(true);
  const [cancelling, setCancelling] = useState<BoardOrder | null>(null);

  const onChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const row = payload.new as { status?: string; order_number?: string };
      if (payload.eventType === "UPDATE" && row.status === "preparing") {
        toast.success(`¡Nuevo pedido ${row.order_number ?? ""}!`, { description: "Ya está pagado y en preparación." });
        if (sound) beep();
      }
    },
    [sound],
  );

  return (
    <div>
      <RealtimeRefresh channel={`vendor-orders:${businessId}`} table="orders" filter={`business_id=eq.${businessId}`} onChange={onChange} />
      <div className="mb-4 flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setSound(!sound)}>
          {sound ? <Volume2 /> : <VolumeX />} {sound ? "Sonido activado" : "Sonido apagado"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((column) => {
          const orders = active.filter((o) => o.status === column.status);
          return (
            <section key={column.status} className="rounded-(--radius-card) bg-muted/60 p-3">
              <header className="mb-3 flex items-center justify-between px-1">
                <div>
                  <h2 className="font-sans text-sm font-semibold tracking-normal">{ORDER_STATUS_LABEL[column.status]}</h2>
                  <p className="text-xs text-muted-foreground">{column.hint}</p>
                </div>
                <Badge tone={orders.length ? "brand" : "gray"}>{orders.length}</Badge>
              </header>
              <div className="space-y-3">
                {orders.length === 0 && (
                  <p className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card/50 py-8 text-sm text-muted-foreground">
                    <Inbox className="size-5" /> Sin pedidos
                  </p>
                )}
                {orders.map((order) => (
                  <OrderCard key={order.id} order={order} readOnly={readOnly} onCancel={() => setCancelling(order)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Últimos 7 días</h2>
          <Card>
            <ul className="divide-y">
              {recent.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="font-medium">{order.order_number}</span>
                  <OrderStatusBadge status={order.status} />
                  <span className="text-muted-foreground">{order.contact_name}</span>
                  {order.cancel_reason && <span className="text-xs text-muted-foreground">· {order.cancel_reason}</span>}
                  <span className="ml-auto tabular-nums">{formatMoney(order.total_minor)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <CancelDialog order={cancelling} onClose={() => setCancelling(null)} />
    </div>
  );
}

function OrderCard({ order, readOnly, onCancel }: { order: BoardOrder; readOnly: boolean; onCancel: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const action = nextVendorAction(order.status, order.service_type);
  const minutes = minutesSince(order.paid_at);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{order.order_number}</p>
          <p className={cn("text-xs", minutes > 60 && order.status === "preparing" ? "font-semibold text-warning" : "text-muted-foreground")}>
            Pagado {order.paid_at ? formatDate(order.paid_at) : ""}
          </p>
        </div>
        <Badge tone={order.service_type === "delivery" ? "violet" : "blue"}>
          {order.service_type === "delivery" ? <Bike className="size-3.5" /> : <Store className="size-3.5" />}
          {order.service_type === "delivery" ? "Delivery" : "Para llevar"}
        </Badge>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {order.items.map((item) => (
          <li key={item.id}>
            <span className="font-semibold">{item.quantity}×</span> {item.product_name}
            {item.note && <span className="block text-xs text-muted-foreground">“{item.note}”</span>}
          </li>
        ))}
      </ul>
      {order.customer_note && <p className="mt-2 rounded-lg bg-warning-soft px-2.5 py-1.5 text-xs">Nota: {order.customer_note}</p>}

      <div className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5 text-foreground">
          <Phone className="size-3.5" /> {order.contact_name} ·{" "}
          <a href={phoneHref(order.contact_phone)} className="underline">{formatPhone(order.contact_phone)}</a>
        </p>
        {order.address_snapshot && (
          <p className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            {order.address_snapshot.address_line}, {order.address_snapshot.municipality}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Total {formatMoney(order.total_minor)}</span>
        <span className="font-semibold">Recibes {formatMoney(order.vendor_net_minor)}</span>
      </div>

      {!readOnly && (
        <div className="mt-3 flex gap-2">
          {action && (
            <Button
              size="sm"
              className="flex-1"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await transitionOrder({ orderId: order.id, to: action.to });
                  if (!result.ok) return void toast.error(result.error);
                  toast.success(`${order.order_number}: ${ORDER_STATUS_LABEL[action.to]}`);
                  router.refresh();
                })
              }
            >
              {action.label}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      )}
    </Card>
  );
}

function CancelDialog({ order, onClose }: { order: BoardOrder | null; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const presets = ["Producto dañado o sin existencias", "No podemos entregar en esa zona", "El cliente pidió cancelar"];

  return (
    <Dialog open={Boolean(order)} onOpenChange={(open) => !open && (onClose(), setReason(""))}>
      {order && (
        <DialogContent
          side="sheet"
          title={`Cancelar ${order.order_number}`}
          description={`Se devolverá ${formatMoney(order.total_minor)} al cliente y el stock volverá a tu inventario. El cliente verá el motivo.`}
        >
          <div className="mb-3 flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button key={preset} type="button" onClick={() => setReason(preset)} className="cursor-pointer rounded-full border px-3 py-1 text-xs hover:border-primary">
                {preset}
              </button>
            ))}
          </div>
          <Field label="Motivo" htmlFor="cancel-reason">
            <Textarea id="cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </Field>
          <div className="mt-5 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Volver
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={reason.trim().length < 5}
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await cancelOrder({ orderId: order.id, reason });
                  if (!result.ok) return void toast.error(result.error);
                  toast.success("Pedido cancelado y reembolsado.");
                  setReason("");
                  onClose();
                  router.refresh();
                })
              }
            >
              Cancelar y reembolsar
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
