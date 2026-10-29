import { AlertTriangle, Banknote, Hourglass, Receipt, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { PeriodFilter } from "@/components/charts/period-filter";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui/card";
import { summarize } from "@/features/reports/compute";
import { reportOrders } from "@/features/reports/queries";
import { requireApprovedBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, formatPercent } from "@/lib/utils";
import type { LedgerEntry, Payout, Strike } from "@/types/domain";

export const metadata: Metadata = { title: "Finanzas" };

type SearchParams = Promise<{ periodo?: string }>;

export default async function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  const { periodo = "30d" } = await searchParams;
  const { business } = await requireApprovedBusiness("/vendedor/finanzas");
  const supabase = await createClient();
  const [{ orders }, { data: payouts }, { data: rate }, { data: ledger }, { data: strikes }, { data: inWindow }] = await Promise.all([
    reportOrders({ period: periodo, businessId: business.id }),
    supabase.from("payouts").select("*").eq("business_id", business.id).order("period_end", { ascending: false }),
    supabase.rpc("commission_rate_for", { p_business: business.id }),
    supabase.from("ledger_entries").select("*").eq("business_id", business.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("strikes").select("*").eq("business_id", business.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("orders").select("vendor_net_minor").eq("business_id", business.id).in("status", ["delivered", "disputed"]),
  ]);
  const summary = summarize(orders);
  const paidPayouts = (payouts ?? []) as Payout[];
  const entries = (ledger ?? []) as LedgerEntry[];
  const unpaid = entries.filter((e) => !e.payout_id);
  const { available, held } = splitBalance(unpaid);
  const inClaimWindow = (inWindow ?? []).reduce((sum, o) => sum + o.vendor_net_minor, 0);
  const activeStrikes = ((strikes ?? []) as Strike[]).filter((s) => !s.voided_at);

  return (
    <>
      <PageHeader
        title="Finanzas"
        description={`Comisión vigente: ${formatPercent(Number(rate ?? 0.08))} sobre los productos. El envío y la tarifa de servicio los cobra Catarina Market, que paga a sus repartidores.`}
        action={<PeriodFilter basePath="/vendedor/finanzas" active={periodo} />}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ventas brutas" value={formatMoney(summary.gross)} icon={<Receipt />} />
        <StatCard label="Comisiones pagadas" value={formatMoney(summary.commission)} icon={<Banknote />} />
        <StatCard label="Neto del período" value={formatMoney(summary.net)} icon={<Wallet />} />
        <StatCard label="Faltas vigentes" value={activeStrikes.length} icon={<AlertTriangle />} hint="3 en 90 días suspenden la tienda" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Disponible para la próxima liquidación</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(available)}</p>
        </Card>
        <Card className="p-5">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Hourglass className="size-4" /> Retenido
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(held + inClaimWindow)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pedidos entregados en su ventana de reclamo (48 h){business.tier === "informal" ? " y retención de 7 días de tus primeros pedidos" : ""}.
          </p>
        </Card>
        <Card className="p-5 text-sm text-muted-foreground">
          Cobras cuando el cliente recibe el pedido con su PIN y pasan 48 h sin reclamos. Si un reclamo se aprueba a tu cargo, se
          descuenta de tu liquidación.
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Movimientos" description="Cada pedido cerrado suma la venta y resta la comisión; los reclamos aprobados restan un ajuste." />
        {entries.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Sin movimientos todavía" className="border-0" />
          </div>
        ) : (
          <ul className="divide-y text-sm">
            {entries.slice(0, 40).map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                <span className="flex-1">{entry.description}</span>
                {entry.payout_id ? (
                  <Badge tone="gray">Liquidado</Badge>
                ) : new Date(entry.available_at) > new Date(entry.created_at) && entry.kind === "sale" ? (
                  <Badge tone="amber">Disponible {formatDate(entry.available_at, false)}</Badge>
                ) : null}
                <span className={entry.amount_minor < 0 ? "w-28 text-right tabular-nums text-destructive" : "w-28 text-right tabular-nums"}>
                  {formatMoney(entry.amount_minor)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(strikes ?? []).length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Faltas" description="Se registran por cancelar pedidos pagados, no preparar a tiempo, rechazos en la recolección y reclamos aprobados a tu cargo." />
          <ul className="divide-y text-sm">
            {((strikes ?? []) as Strike[]).map((strike) => (
              <li key={strike.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                <span className={strike.voided_at ? "flex-1 text-muted-foreground line-through" : "flex-1"}>{strike.reason}</span>
                {strike.voided_at && <Badge tone="gray">Anulada</Badge>}
                <span className="text-xs text-muted-foreground">{formatDate(strike.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

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
                  <th className="px-5 py-3 text-right font-medium">Ajustes</th>
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
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(p.adjustments_minor)}</td>
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

/** Saldo sin liquidar: disponible (ya pasó la retención) y retenido. */
function splitBalance(entries: LedgerEntry[]) {
  const now = Date.now();
  let available = 0;
  let held = 0;
  for (const entry of entries) {
    if (new Date(entry.available_at).getTime() <= now) available += entry.amount_minor;
    else held += entry.amount_minor;
  }
  return { available, held };
}
