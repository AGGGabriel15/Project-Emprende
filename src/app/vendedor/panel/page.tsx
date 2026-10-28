import { AlertTriangle, Ban, Coins, Package, Receipt, ShoppingBag, Star, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Stars } from "@/components/catalog/rating";
import { SimpleBarChart } from "@/components/charts/bar-chart";
import { PeriodFilter } from "@/components/charts/period-filter";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader, StatCard } from "@/components/ui/card";
import { salesSeries, summarize, topProducts } from "@/features/reports/compute";
import { reportOrders, seriesLabel } from "@/features/reports/queries";
import { requireApprovedBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, formatPercent } from "@/lib/utils";
import type { Product, Review } from "@/types/domain";

export const metadata: Metadata = { title: "Panel" };

type SearchParams = Promise<{ periodo?: string }>;

export default async function VendorDashboard({ searchParams }: { searchParams: SearchParams }) {
  const { periodo = "30d" } = await searchParams;
  const { business } = await requireApprovedBusiness("/vendedor/panel");
  const supabase = await createClient();
  const [{ orders, range }, { data: lowStock }, { data: reviews }, { count: preparing }] = await Promise.all([
    reportOrders({ period: periodo, businessId: business.id, withItems: true }),
    supabase.from("products").select("id, name, stock").eq("business_id", business.id).eq("is_active", true).lte("stock", 3).order("stock").limit(8),
    supabase.from("reviews").select("*").eq("business_id", business.id).order("created_at", { ascending: false }).limit(4),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "preparing"),
  ]);
  const summary = summarize(orders);
  const series = salesSeries(orders, range.from, range.to, range.granularity);
  const top = topProducts(orders);

  return (
    <>
      <PageHeader
        eyebrow="Panel del vendedor"
        title={`Hola, ${business.trade_name}`}
        action={<PeriodFilter basePath="/vendedor/panel" active={periodo} />}
      />

      {(preparing ?? 0) > 0 && (
        <Link href="/vendedor/pedidos" className="mb-6 flex items-center justify-between gap-3 rounded-2xl bg-primary p-4 text-primary-foreground transition hover:bg-primary-hover">
          <span className="flex items-center gap-3 font-medium">
            <ShoppingBag className="size-5" /> Tienes {preparing} {preparing === 1 ? "pedido" : "pedidos"} en preparación
          </span>
          <span className="text-sm underline">Abrir tablero</span>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ventas (productos)" value={formatMoney(summary.gross)} icon={<Receipt />} hint={`${summary.orders} pedidos`} />
        <StatCard label="Ticket promedio" value={formatMoney(summary.avgTicket)} icon={<Coins />} hint="Incluye envío" />
        <StatCard label="Neto a recibir" value={formatMoney(summary.net)} icon={<Wallet />} hint={`Comisión: ${formatMoney(summary.commission)}`} />
        <StatCard label="Tasa de cancelación" value={formatPercent(summary.cancellationRate)} icon={<Ban />} hint={`${summary.cancelled} cancelados`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="Ventas" description={`Subtotal de productos por ${range.granularity === "day" ? "día" : range.granularity === "week" ? "semana" : "mes"}`} />
          <CardBody>
            {summary.orders === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Aún no hay ventas en este período.</p>
            ) : (
              <SimpleBarChart
                ariaLabel="Ventas por período"
                data={series.map((p) => ({ label: seriesLabel(p.key, range.granularity), value: p.sales, detail: `${p.orders} pedidos` }))}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Más vendidos" />
          <CardBody>
            {top.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
            ) : (
              <ol className="space-y-3">
                {top.map((p, i) => (
                  <li key={p.name} className="flex items-center gap-3 text-sm">
                    <span className="grid size-7 place-items-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.quantity} unidades</span>
                    </span>
                    <span className="tabular-nums">{formatMoney(p.revenue)}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Stock bajo"
            description="Productos visibles con 3 unidades o menos."
            action={<Button asChild variant="outline" size="sm"><Link href="/vendedor/productos">Productos</Link></Button>}
          />
          <CardBody>
            {(lowStock ?? []).length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Package className="size-4" /> Todo con buen inventario.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(lowStock as Pick<Product, "id" | "name" | "stock">[]).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3">
                    <Link href={`/vendedor/productos/${p.id}`} className="truncate hover:text-primary">{p.name}</Link>
                    <span className={p.stock === 0 ? "flex items-center gap-1 font-semibold text-destructive" : "font-semibold text-warning"}>
                      {p.stock === 0 && <AlertTriangle className="size-3.5" />}
                      {p.stock === 0 ? "Agotado" : `${p.stock} u.`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Reseñas recientes" description={business.rating_count ? `${Number(business.rating_avg).toFixed(1)} de 5 · ${business.rating_count} reseñas` : undefined} />
          <CardBody>
            {(reviews ?? []).length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Star className="size-4" /> Aún no tienes reseñas.</p>
            ) : (
              <ul className="space-y-3">
                {(reviews as Review[]).map((r) => (
                  <li key={r.id} className="text-sm">
                    <div className="flex items-center justify-between">
                      <Stars value={r.rating} size="size-3.5" />
                      <span className="text-xs text-muted-foreground">{formatDate(r.created_at, false)}</span>
                    </div>
                    {r.comment && <p className="mt-1 text-muted-foreground">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
