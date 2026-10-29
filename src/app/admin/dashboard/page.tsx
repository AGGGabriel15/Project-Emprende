import { Clock, Coins, Receipt, ShoppingBag, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SimpleBarChart } from "@/components/charts/bar-chart";
import { PeriodFilter } from "@/components/charts/period-filter";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Card, CardBody, CardHeader, PageHeader, StatCard } from "@/components/ui/card";
import { countByStatus, periodRange, salesSeries, summarize } from "@/features/reports/compute";
import { reportOrders, seriesLabel } from "@/features/reports/queries";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatPercent } from "@/lib/utils";
import type { OrderStatus } from "@/types/domain";

export const metadata: Metadata = { title: "Dashboard" };

type SearchParams = Promise<{ periodo?: string }>;

export default async function AdminDashboard({ searchParams }: { searchParams: SearchParams }) {
  const { periodo = "30d" } = await searchParams;
  const supabase = await createClient();
  const range = periodRange(periodo);
  const [{ orders }, { data: businesses }, { data: profitData }] = await Promise.all([
    reportOrders({ period: periodo }),
    supabase.from("businesses").select("id, trade_name, slug, status"),
    supabase.rpc("platform_profit", { p_start: range.from, p_end: range.to }),
  ]);
  const profit = (profitData ?? {}) as Record<string, number>;
  const profitRows: [string, number, string?][] = [
    ["Comisiones (pedidos completados)", profit.commission ?? 0],
    ["Tarifas de servicio", profit.service_fees ?? 0],
    ["Envíos cobrados", profit.delivery_fees ?? 0],
    ["Costo de repartidores", -(profit.courier_costs ?? 0)],
    ["Pasarela (estimado)", -(profit.gateway_fees ?? 0)],
    ["Reembolsos a cargo de la plataforma", -(profit.platform_refunds ?? 0)],
  ];
  const summary = summarize(orders);
  const series = salesSeries(orders, range.from, range.to, range.granularity);
  const byStatus = countByStatus(orders);
  const statusCount = (s: string) => (businesses ?? []).filter((b) => b.status === s).length;

  const byBusiness = new Map<string, number>();
  for (const o of orders) {
    if (["cancelled", "refunded"].includes(o.status)) continue;
    byBusiness.set(o.business_id, (byBusiness.get(o.business_id) ?? 0) + o.subtotal_minor);
  }
  const top = [...byBusiness.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id, gross]) => ({ business: businesses?.find((b) => b.id === id), gross }));

  return (
    <>
      <PageHeader title="Dashboard" eyebrow="Administración" action={<PeriodFilter basePath="/admin/dashboard" active={periodo} />} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ventas totales (GMV)" value={formatMoney(summary.total)} icon={<Receipt />} hint={`${summary.orders} pedidos`} />
        <StatCard label="Ingresos por comisión" value={formatMoney(summary.commission)} icon={<Coins />} hint={summary.gross ? `${formatPercent(summary.commission / summary.gross)} efectivo` : undefined} />
        <StatCard label="Negocios activos" value={statusCount("approved")} icon={<Store />} hint={`${statusCount("suspended")} suspendidos`} />
        <Link href="/admin/solicitudes">
          <StatCard label="Solicitudes pendientes" value={statusCount("pending")} icon={<Clock />} hint="Revisar ahora →" />
        </Link>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="GMV por período" description="Subtotal de productos de pedidos pagados" />
          <CardBody>
            <SimpleBarChart
              ariaLabel="Ventas de la plataforma"
              data={series.map((p) => ({ label: seriesLabel(p.key, range.granularity), value: p.sales, detail: `${p.orders} pedidos` }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Pedidos por estado" />
          <CardBody>
            <ul className="space-y-2.5">
              {(Object.entries(byStatus) as [OrderStatus, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => (
                  <li key={status} className="flex items-center justify-between">
                    <OrderStatusBadge status={status} />
                    <span className="font-semibold tabular-nums">{count}</span>
                  </li>
                ))}
              {orders.length === 0 && <li className="text-sm text-muted-foreground">Sin pedidos en el período.</li>}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Ganancia de la plataforma"
          description={`Pedidos pagados en el período. Reserva para reclamos apartada: ${formatMoney(profit.reserve ?? 0)}. Reembolsos totales: ${formatMoney(profit.refunds_total ?? 0)}.`}
        />
        <CardBody>
          <dl className="space-y-2 text-sm">
            {profitRows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className={value < 0 ? "tabular-nums text-destructive" : "tabular-nums"}>{formatMoney(value)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t pt-2 text-base font-semibold">
              <dt>Ganancia neta estimada</dt>
              <dd className="tabular-nums">{formatMoney(profit.net ?? 0)}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Top negocios" description="Por ventas de productos en el período" />
        <ul className="divide-y">
          {top.map(({ business, gross }, index) => (
            <li key={business?.id ?? index} className="flex items-center gap-3 px-5 py-3 text-sm">
              <span className="grid size-7 place-items-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span>
              <Link href={`/negocios/${business?.slug}`} className="flex-1 font-medium hover:text-primary">{business?.trade_name}</Link>
              <span className="tabular-nums">{formatMoney(gross)}</span>
            </li>
          ))}
          {top.length === 0 && (
            <li className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
              <ShoppingBag className="size-4" /> Aún no hay ventas.
            </li>
          )}
        </ul>
      </Card>
    </>
  );
}
