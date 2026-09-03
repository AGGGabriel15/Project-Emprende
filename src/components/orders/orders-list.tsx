"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clientApi } from "@/lib/client-api";
import { formatMoney } from "@/lib/utils";
import type {
  FulfillmentMethod,
  OrderStatus,
  PaymentStatus,
} from "@/types/domain";

type OrderView = {
  id: string;
  orderNumber: string;
  totalMinor: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentMethod: FulfillmentMethod;
  deliveryAddress?: string;
  contactName: string;
  phone: string;
  createdAt: string;
  entrepreneur?: { businessName: string; address: string; phone: string };
  customer?: { name: string; email: string };
  items: Array<{ name: string; quantity: number; subtotalMinor: number }>;
};

const labels: Record<OrderStatus, string> = {
  pending_payment: "Pendiente de pago",
  paid: "Pagado",
  preparing: "En preparación",
  ready_for_pickup: "Listo para retirar",
  out_for_delivery: "En camino",
  completed: "Completado",
  cancelled: "Cancelado",
};

function nextStatuses(order: OrderView) {
  if (order.status === "paid") return ["preparing"] as OrderStatus[];
  if (order.status === "preparing")
    return [
      order.fulfillmentMethod === "pickup"
        ? "ready_for_pickup"
        : "out_for_delivery",
    ] as OrderStatus[];
  if (["ready_for_pickup", "out_for_delivery"].includes(order.status))
    return ["completed"] as OrderStatus[];
  return [];
}

export function OrdersList({ manageable = false }: { manageable?: boolean }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["orders"],
    queryFn: () => clientApi<OrderView[]>("/api/pedidos"),
  });
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      clientApi(`/api/pedidos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });
  if (query.isLoading)
    return (
      <p className="rounded-2xl border bg-white p-8 text-center">
        Cargando pedidos…
      </p>
    );
  if (query.error)
    return (
      <p className="rounded-2xl bg-red-50 p-5 text-red-700">
        {query.error.message}
      </p>
    );
  if (!query.data?.length)
    return (
      <p className="rounded-2xl border border-dashed bg-white p-10 text-center text-[#65736b]">
        No hay pedidos todavía.
      </p>
    );
  return (
    <div className="space-y-4">
      {query.data.map((order) => (
        <article
          key={order.id}
          className="rounded-2xl border bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-[#75837b]">
                {order.orderNumber}
              </p>
              <h3 className="mt-1 text-xl font-bold">
                {manageable
                  ? order.customer?.name
                  : order.entrepreneur?.businessName}
              </h3>
              <p className="text-xs text-[#75837b]">
                {new Intl.DateTimeFormat("es-NI", {
                  dateStyle: "medium",
                }).format(new Date(order.createdAt))}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge
                tone={
                  order.paymentStatus === "paid"
                    ? "green"
                    : order.status === "cancelled"
                      ? "red"
                      : "amber"
                }
              >
                {labels[order.status]}
              </Badge>
              <Badge tone="gray">
                {order.fulfillmentMethod === "pickup" ? "Retiro" : "Entrega"}
              </Badge>
            </div>
          </div>
          <div className="my-4 border-y py-3">
            {order.items.map((item) => (
              <div
                key={item.name}
                className="flex justify-between gap-3 py-1 text-sm"
              >
                <span>
                  {item.quantity} × {item.name}
                </span>
                <span>{formatMoney(item.subtotalMinor)}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-[#75837b]">Total</p>
              <p className="font-serif text-2xl font-bold">
                {formatMoney(order.totalMinor)}
              </p>
            </div>
            {manageable && (
              <div className="flex gap-2">
                {nextStatuses(order).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    onClick={() => mutation.mutate({ id: order.id, status })}
                    disabled={mutation.isPending}
                  >
                    Marcar: {labels[status]}
                  </Button>
                ))}
              </div>
            )}
          </div>
          {manageable && (
            <p className="mt-3 text-xs text-[#65736b]">
              Contacto: {order.phone}
              {order.deliveryAddress ? ` · ${order.deliveryAddress}` : ""}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
