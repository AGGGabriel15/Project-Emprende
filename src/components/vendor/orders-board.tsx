"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Bike, Camera, Inbox, KeyRound, Loader2, MapPin, Phone, Store, Truck, Volume2, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { cancelOrder, completeWithPin, markOrderReady } from "@/features/orders/actions";
import { vendorAction } from "@/features/orders/status";
import { downscaleImage } from "@/lib/image";
import { createClient, getBrowserSession } from "@/lib/supabase/client";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import type { OrderStatus } from "@/types/domain";
import type { BoardOrder } from "@/features/orders/queries";
import { formatPhone, phoneHref } from "@/lib/phone";

const COLUMNS: { title: string; statuses: OrderStatus[]; hint: string }[] = [
  { title: "En preparación", statuses: ["preparing"], hint: "Empácalo y marca listo con una foto" },
  { title: "Listos", statuses: ["ready", "ready_for_pickup"], hint: "Esperan al repartidor o al cliente" },
  { title: "En camino", statuses: ["on_the_way"], hint: "El repartidor lo lleva al cliente" },
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
  const [readying, setReadying] = useState<BoardOrder | null>(null);
  const [handing, setHanding] = useState<BoardOrder | null>(null);

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
      {/* Repartidor asignado o llegando a recoger (la RLS limita a los envíos de sus pedidos). */}
      <RealtimeRefresh channel={`vendor-shipments:${businessId}`} table="shipments" />
      <div className="mb-4 flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setSound(!sound)}>
          {sound ? <Volume2 /> : <VolumeX />} {sound ? "Sonido activado" : "Sonido apagado"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((column) => {
          const orders = active.filter((o) => column.statuses.includes(o.status));
          return (
            <section key={column.title} className="rounded-(--radius-card) bg-muted/60 p-3">
              <header className="mb-3 flex items-center justify-between px-1">
                <div>
                  <h2 className="font-sans text-sm font-semibold tracking-normal">{column.title}</h2>
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
                  <OrderCard
                    key={order.id}
                    order={order}
                    readOnly={readOnly}
                    onCancel={() => setCancelling(order)}
                    onReady={() => setReadying(order)}
                    onHandOver={() => setHanding(order)}
                  />
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
      <ReadyDialog order={readying} onClose={() => setReadying(null)} />
      <PinDialog order={handing} onClose={() => setHanding(null)} />
    </div>
  );
}

function OrderCard({
  order,
  readOnly,
  onCancel,
  onReady,
  onHandOver,
}: {
  order: BoardOrder;
  readOnly: boolean;
  onCancel: () => void;
  onReady: () => void;
  onHandOver: () => void;
}) {
  const action = vendorAction(order.status, order.service_type, Boolean(order.shipment));
  const minutes = minutesSince(order.paid_at);
  const overdue = order.status === "preparing" && order.sla_due_at !== null && minutesUntil(order.sla_due_at) < 120;

  return (
    <Card className="p-4" data-order={order.order_number}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{order.order_number}</p>
          <p className={cn("text-xs", minutes > 60 && order.status === "preparing" ? "font-semibold text-warning" : "text-muted-foreground")}>
            Pagado {order.paid_at ? formatDate(order.paid_at) : ""}
          </p>
        </div>
        <Badge tone={order.service_type === "delivery" ? "violet" : "blue"}>
          {order.service_type === "delivery" ? <Bike className="size-3.5" /> : <Store className="size-3.5" />}
          {order.service_type === "delivery" ? "Delivery" : "Retiro"}
        </Badge>
      </div>

      {order.status === "preparing" && order.sla_due_at && (
        <p className={cn("mt-2 rounded-lg px-2.5 py-1.5 text-xs", overdue ? "bg-destructive-soft text-destructive" : "bg-muted text-muted-foreground")}>
          Márcalo listo antes de {formatDate(order.sla_due_at)} o se cancelará con falta.
        </p>
      )}

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
        {order.service_type === "pickup" ? (
          <p className="flex items-center gap-1.5 text-foreground">
            <Phone className="size-3.5" /> {order.contact_name} ·{" "}
            <a href={phoneHref(order.contact_phone)} className="underline">{formatPhone(order.contact_phone)}</a>
          </p>
        ) : (
          <p className="flex items-start gap-1.5">
            <Truck className="mt-0.5 size-3.5 shrink-0" />
            {order.shipment?.courier_name ? (
              <span className={cn(order.shipment.status === "at_pickup" && "font-semibold text-primary")}>
                Repartidor: {order.shipment.courier_name} · {SHIPMENT_LABEL[order.shipment.status] ?? order.shipment.status}
              </span>
            ) : order.status === "ready" ? (
              "Buscando repartidor"
            ) : (
              "La entrega la coordina Catarina Market"
            )}
          </p>
        )}
        {order.address_snapshot && (
          <p className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            {order.address_snapshot.municipality}, {order.address_snapshot.department}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Productos {formatMoney(order.subtotal_minor)}</span>
        <span className="font-semibold">Recibes {formatMoney(order.vendor_net_minor)}</span>
      </div>

      {!readOnly && (action || ["preparing", "ready", "ready_for_pickup"].includes(order.status)) && (
        <div className="mt-3 flex gap-2">
          {action && (
            <Button size="sm" className="flex-1" onClick={action.kind === "ready" ? onReady : onHandOver}>
              {action.kind === "ready" ? <Camera /> : <KeyRound />} {action.label}
            </Button>
          )}
          {["preparing", "ready", "ready_for_pickup"].includes(order.status) && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={onCancel}>
              Cancelar
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

const SHIPMENT_LABEL: Record<string, string> = {
  available: "buscando repartidor",
  assigned: "va camino a tu negocio",
  at_pickup: "llegó a recoger",
  picked_up: "lo lleva al cliente",
  at_dropoff: "llegó donde el cliente",
  delivered: "entregado",
  rejected: "rechazado al recoger",
  returned: "devuelto",
  failed: "intento fallido",
};

function minutesUntil(iso: string) {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
}

/** Foto del pedido empacado: evidencia de lo que se entrega al repartidor o al cliente. */
function ReadyDialog({ order, onClose }: { order: BoardOrder | null; onClose: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setFile(null);
    setPreview(null);
    onClose();
  }

  return (
    <Dialog open={Boolean(order)} onOpenChange={(open) => !open && close()}>
      {order && (
        <DialogContent
          side="sheet"
          title={`Marcar listo ${order.order_number}`}
          description={
            order.service_type === "delivery"
              ? "Toma una foto del pedido empacado. El repartidor la compara al recogerlo: si no coincide, lo rechaza."
              : "Toma una foto del pedido empacado. Le avisaremos al cliente que pase a retirarlo con su PIN."
          }
        >
          <label className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed bg-muted/40 text-sm text-muted-foreground hover:border-primary hover:text-primary">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Foto del pedido" className="h-full w-full object-cover" />
            ) : (
              <>
                <Camera className="size-6" /> Tomar o elegir foto
              </>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="sr-only"
              aria-label="Foto del pedido empacado"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
                setPreview(selected ? URL.createObjectURL(selected) : null);
              }}
            />
          </label>
          <div className="mt-5 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={close}>
              Volver
            </Button>
            <Button
              className="flex-1"
              disabled={!file}
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    const supabase = createClient();
                    const user = await getBrowserSession();
                    if (!user || !file) throw new Error("Inicia sesión de nuevo.");
                    const photo = await downscaleImage(file);
                    const path = `${user.userId}/ready/${crypto.randomUUID()}.${photo.type === "image/webp" ? "webp" : "png"}`;
                    const { error } = await supabase.storage.from("delivery-evidence").upload(path, photo, { contentType: photo.type });
                    if (error) throw error;
                    const result = await markOrderReady(order.id, path);
                    if (!result.ok) throw new Error(result.error);
                    toast.success(`${order.order_number} listo.`);
                    close();
                    router.refresh();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "No pudimos marcarlo listo.");
                  }
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <Camera />} Confirmar listo
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

/** Entrega en el local: el cliente dice su PIN de 4 dígitos. */
function PinDialog({ order, onClose }: { order: BoardOrder | null; onClose: () => void }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={Boolean(order)} onOpenChange={(open) => !open && (onClose(), setPin(""))}>
      {order && (
        <DialogContent
          side="sheet"
          title={`Entregar ${order.order_number}`}
          description="Pídele al cliente el PIN de 4 dígitos que ve en su pedido. Sin PIN no se puede entregar."
        >
          <Field label="PIN del cliente" htmlFor="pickup-pin">
            <Input
              id="pickup-pin"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="text-center text-2xl font-semibold tracking-[0.5em]"
            />
          </Field>
          <div className="mt-5 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => (onClose(), setPin(""))}>
              Volver
            </Button>
            <Button
              className="flex-1"
              disabled={pin.length !== 4}
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await completeWithPin(order.id, pin);
                  if (!result.ok) return void toast.error(result.error);
                  toast.success("Entrega confirmada.");
                  setPin("");
                  onClose();
                  router.refresh();
                })
              }
            >
              <KeyRound /> Confirmar entrega
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
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
          description={`Se devolverá ${formatMoney(order.total_minor)} al cliente y el stock volverá a tu inventario. Cancelar un pedido pagado cuenta como falta: con 3 faltas en 90 días tu tienda se suspende.`}
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
                  if (result.data?.warning) toast.warning(result.data.warning);
                  else toast.success("Pedido cancelado y reembolsado.");
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
