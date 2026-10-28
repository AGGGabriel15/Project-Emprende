import { FileSpreadsheet, FileText } from "lucide-react";
import type { Metadata } from "next";
import { SimpleBarChart } from "@/components/charts/bar-chart";
import { PeriodFilter } from "@/components/charts/period-filter";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { salesSeries, summarize, topProducts } from "@/features/reports/compute";
import { reportOrders, seriesLabel } from "@/features/reports/queries";
import { requireApprovedBusiness } from "@/lib/auth";
import { formatMoney, formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Reportes" };

type SearchParams = Promise<{ periodo?: string }>;

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const { periodo = "30d" } = await searchParams;
  const { business } = await requireApprovedBusiness("/vendedor/reportes");
  const { orders, range } = await reportOrders({ period: periodo, businessId: business.id, withItems: true });
  const summary = summarize(orders);
  const series = salesSeries(orders, range.from, range.to, range.granularity);
  const top = topProducts(orders, 10);

  return (
    <>
      <PageHeader
        title="Reportes"
        description={`Del ${range.from} al ${range.to}`}
        action={
          <>
            <PeriodFilter basePath="/vendedor/reportes" active={periodo} />
            <Button asChild variant="outline" size="sm">
              <a href={`/vendedor/reportes/exportar?formato=xlsx&periodo=${periodo}`}>
                <FileSpreadsheet /> Excel
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/vendedor/reportes/exportar?formato=pdf&periodo=${periodo}`}>
                <FileText /> PDF
              </a>
            </Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Ventas por período" />
          <CardBody>
            <SimpleBarChart
              ariaLabel="Ventas por período"
              data={series.map((p) => ({ label: seriesLabel(p.key, range.granularity), value: p.sales, detail: `${p.orders} pedidos` }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Pedidos por período" />
          <CardBody>
            <SimpleBarChart
              money={false}
              ariaLabel="Pedidos por período"
              data={series.map((p) => ({ label: seriesLabel(p.key, range.granularity), value: p.orders }))}
            />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader title="Resumen" />
          <CardBody>
            <dl className="space-y-2 text-sm">
              {[
                ["Pedidos vendidos", summary.orders.toString()],
                ["Ventas de productos", formatMoney(summary.gross)],
                ["Envíos", formatMoney(summary.delivery)],
                ["Comisión", formatMoney(summary.commission)],
                ["Neto", formatMoney(summary.net)],
                ["Ticket promedio", formatMoney(summary.avgTicket)],
                ["Cancelados", `${summary.cancelled} (${formatPercent(summary.cancellationRate)})`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Productos más vendidos" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Producto</th>
                  <th className="px-5 py-3 text-right font-medium">Unidades</th>
                  <th className="px-5 py-3 text-right font-medium">Ingresos</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {top.map((p) => (
                  <tr key={p.name}>
                    <td className="px-5 py-2.5">{p.name}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{p.quantity}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{formatMoney(p.revenue)}</td>
                  </tr>
                ))}
                {top.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-muted-foreground">Sin ventas en el período.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
