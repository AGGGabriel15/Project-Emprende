import type { Metadata } from "next";
import Link from "next/link";
import { PromptActionButton } from "@/components/admin/action-buttons";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Card, PageHeader } from "@/components/ui/card";
import { cancelOrder } from "@/features/orders/actions";
import { ORDER_STATUS_LABEL, SERVICE_LABEL, VENDOR_CANCELLABLE } from "@/features/orders/status";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import type { OrderStatus } from "@/types/domain";

export const metadata: Metadata = { title: "Pedidos" };

type SearchParams = Promise<{ estado?: string; q?: string }>;

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const { estado = "all", q } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("id, order_number, status, service_type, total_minor, commission_amount_minor, created_at, contact_name, cancel_reason, business:businesses(trade_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (estado !== "all") query = query.eq("status", estado);
  if (q) query = query.ilike("order_number", `%${q.replace(/[%,()]/g, "").trim()}%`);
  const { data } = await query;

  return (
    <>
      <PageHeader title="Pedidos" description="Todos los pedidos de la plataforma. Un admin puede cancelar con motivo (reembolso automático)." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav className="scrollbar-none flex gap-1 overflow-x-auto">
          {(["all", ...Object.keys(ORDER_STATUS_LABEL)] as (OrderStatus | "all")[]).map((s) => (
            <Link
              key={s}
              href={`/admin/pedidos?estado=${s}`}
              className={cn("rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap", estado === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}
            >
              {s === "all" ? "Todos" : ORDER_STATUS_LABEL[s]}
            </Link>
          ))}
        </nav>
        <form className="ml-auto">
          <input type="hidden" name="estado" value={estado} />
          <input name="q" defaultValue={q} placeholder="Buscar CM-…" className="h-9 rounded-full border bg-card px-4 text-sm focus:border-primary focus:outline-none" />
        </form>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Pedido</th>
                <th className="px-5 py-3 font-medium">Negocio</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 text-right font-medium">Comisión</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {(data ?? []).map((order) => {
                const business = order.business as unknown as { trade_name: string } | null;
                const status = order.status as OrderStatus;
                return (
                  <tr key={order.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(order.created_at)} · {SERVICE_LABEL[order.service_type as "delivery" | "pickup"]} · {order.contact_name}
                      </p>
                    </td>
                    <td className="px-5 py-3">{business?.trade_name}</td>
                    <td className="px-5 py-3">
                      <OrderStatusBadge status={status} />
                      {order.cancel_reason && <p className="mt-1 max-w-56 text-xs text-muted-foreground">{order.cancel_reason}</p>}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(order.total_minor)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(order.commission_amount_minor)}</td>
                    <td className="px-5 py-3 text-right">
                      {[...VENDOR_CANCELLABLE, "on_the_way"].includes(status) && (
                        <PromptActionButton
                          size="sm"
                          variant="danger"
                          title={`Cancelar ${order.order_number}`}
                          description="Se repone el stock y se reembolsa todo al cliente (a cargo de la plataforma, sin falta al negocio)."
                          label="Motivo (disputa, fraude, etc.)"
                          confirmLabel="Cancelar y reembolsar"
                          success="Pedido cancelado."
                          action={async (reason: string) => {
                            "use server";
                            return cancelOrder({ orderId: order.id, reason });
                          }}
                        >
                          Cancelar
                        </PromptActionButton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
