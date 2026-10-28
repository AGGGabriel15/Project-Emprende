import { ChevronRight, Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProductImage } from "@/components/catalog/product-image";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { ResumePaymentButton } from "@/components/orders/resume-payment-button";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { listOrders } from "@/features/orders/queries";
import { CUSTOMER_TABS, SERVICE_LABEL, type CustomerTab } from "@/features/orders/status";
import { requireCustomer } from "@/lib/auth";
import { cn, formatDate, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Mis pedidos" };

const TAB_LABEL: Record<CustomerTab, string> = {
  pendientes: "Pendientes",
  activos: "Activos",
  historial: "Historial",
};

const EMPTY: Record<CustomerTab, string> = {
  pendientes: "No tienes pagos pendientes.",
  activos: "No tienes pedidos en curso.",
  historial: "Aún no tienes pedidos completados.",
};

type SearchParams = Promise<{ tab?: string }>;

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const { profile } = await requireCustomer("/pedidos");
  const orders = await listOrders({ customerId: profile.id });
  const { tab: rawTab } = await searchParams;
  const counts = Object.fromEntries(
    (Object.keys(CUSTOMER_TABS) as CustomerTab[]).map((key) => [
      key,
      orders.filter((o) => (CUSTOMER_TABS[key] as readonly string[]).includes(o.status)).length,
    ]),
  ) as Record<CustomerTab, number>;
  const tab: CustomerTab =
    rawTab && rawTab in CUSTOMER_TABS ? (rawTab as CustomerTab) : counts.activos ? "activos" : counts.pendientes ? "pendientes" : "historial";
  const visible = orders.filter((o) => (CUSTOMER_TABS[tab] as readonly string[]).includes(o.status));

  return (
    <div className="container-page max-w-4xl py-8">
      <RealtimeRefresh channel={`customer-orders:${profile.id}`} table="orders" filter={`customer_id=eq.${profile.id}`} />
      <PageHeader title="Mis pedidos" description="Se actualizan en tiempo real cuando el negocio cambia su estado." />

      <nav className="scrollbar-none mb-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1" aria-label="Estado de pedidos">
        {(Object.keys(CUSTOMER_TABS) as CustomerTab[]).map((key) => (
          <Link
            key={key}
            href={`/pedidos?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition",
              tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {TAB_LABEL[key]}
            {counts[key] > 0 && (
              <span className={cn("rounded-full px-1.5 text-xs", key === "pendientes" ? "bg-warning-soft text-warning" : "bg-muted")}>
                {counts[key]}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title={EMPTY[tab]}
          action={
            <Button asChild variant="outline">
              <Link href="/buscar">Explorar productos</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((order) => (
            <li key={order.id}>
              <Card className="transition hover:shadow-md">
                <Link href={`/pedidos/${order.id}`} className="flex items-center gap-4 p-4 sm:p-5">
                  <div className="flex -space-x-3">
                    {order.items.slice(0, 3).map((item, index) => (
                      <ProductImage key={index} src={item.image_url} alt="" className="size-12 rounded-xl border-2 border-card" sizes="48px" />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{order.business.trade_name}</p>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {order.items.map((i) => `${i.quantity}× ${i.product_name}`).join(", ")}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {order.order_number} · {SERVICE_LABEL[order.service_type]} · {formatDate(order.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{formatMoney(order.total_minor)}</p>
                    <ChevronRight className="ml-auto size-5 text-muted-foreground" />
                  </div>
                </Link>
                {order.status === "pending_payment" && (
                  <div className="flex items-center justify-between gap-3 border-t bg-warning-soft/50 px-5 py-3 text-sm">
                    <span>Vence {order.expires_at ? formatDate(order.expires_at) : "pronto"}</span>
                    <ResumePaymentButton orderId={order.id} size="sm" />
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
