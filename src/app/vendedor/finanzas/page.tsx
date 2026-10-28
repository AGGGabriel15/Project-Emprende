import { Banknote, Receipt, Truck, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { PeriodFilter } from "@/components/charts/period-filter";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui/card";
import { summarize } from "@/features/reports/compute";
import { reportOrders } from "@/features/reports/queries";
import { requireApprovedBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, formatPercent } from "@/lib/utils";
import type { Payout } from "@/types/domain";

export const metadata: Metadata = { title: "Finanzas" };

type SearchParams = Promise<{ periodo?: string }>;

export default async function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  const { periodo = "30d" } = await searchParams;
  const { business } = await requireApprovedBusiness("/vendedor/finanzas");
  const supabase = await createClient();
  const [{ orders }, { data: payouts }, { data: rate }, { data: unpaidOrders }] = await Promise.all([
    reportOrders({ period: periodo, businessId: business.id }),
    supabase.from("payouts").select("*").eq("business_id", business.id).order("period_end", { ascending: false }),
    supabase.rpc("commission_rate_for", { p_business: business.id }),
    supabase.from("orders").select("vendor_net_minor, completed_at").eq("business_id", business.id).eq("status", "completed"),
  ]);
  const summary = summarize(orders);
  const paidPayouts = (payouts ?? []) as Payout[];
  const lastPeriodEnd = paidPayouts[0]?.period_end;
  const pendingBalance = (unpaidOrders ?? [])
    .filter((o) => !lastPeriodEnd || (o.completed_at && o.completed_at.slice(0, 10) > lastPeriodEnd))
    .reduce((sum, o) => sum + o.vendor_net_minor, 0);

  return (
    <>
      <PageHeader
        title="Finanzas"
        description={`Comisión vigente: ${formatPercent(Number(rate ?? 0.08))} sobre el subtotal de productos. El envío es 100 % tuyo.`}
        action={<PeriodFilter basePath="/vendedor/finanzas" active={periodo} />}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ventas brutas" value={formatMoney(summary.gross)} icon={<Receipt />} />
        <StatCard label="Comisiones pagadas" value={formatMoney(summary.commission)} icon={<Banknote />} />
        <StatCard label="Envíos cobrados" value={formatMoney(summary.delivery)} icon={<Truck />} />
        <StatCard label="Neto del período" value={formatMoney(summary.net)} icon={<Wallet />} />
      </div>

      <Card className="mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">Saldo por liquidar (pedidos completados aún no liquidados)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(pendingBalance)}</p>
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">
          La administración genera las liquidaciones por período y transfiere a tu cuenta registrada.
        </p>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Historial de liquidaciones" />
        {paidPayouts.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Sin liquidaciones todavía" description="Aparecerán aquí cuando la administración las genere." className="border-0" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Período</th>
                  <th className="px-5 py-3 text-right font-medium">Pedidos</th>
                  <th className="px-5 py-3 text-right font-medium">Bruto</th>
                  <th className="px-5 py-3 text-right font-medium">Comisión</th>
                  <th className="px-5 py-3 text-right font-medium">Neto</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paidPayouts.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3">{formatDate(`${p.period_start}T12:00:00`, false)} – {formatDate(`${p.period_end}T12:00:00`, false)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{p.orders_count}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(p.gross_minor)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(p.commission_minor)}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatMoney(p.net_minor)}</td>
                    <td className="px-5 py-3">
                      {p.status === "paid" ? <Badge tone="green">Pagado {p.paid_at ? formatDate(p.paid_at, false) : ""}</Badge> : <Badge tone="amber">Pendiente</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
