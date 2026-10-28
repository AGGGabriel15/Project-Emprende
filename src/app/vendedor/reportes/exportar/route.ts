import { NextResponse, type NextRequest } from "next/server";
import { salesSeries, summarize, topProducts } from "@/features/reports/compute";
import { reportToExcel, reportToPdf } from "@/features/reports/export";
import { reportOrders } from "@/features/reports/queries";
import { getMyBusiness } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const business = await getMyBusiness();
  if (!business || !["approved", "suspended"].includes(business.status)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  const format = request.nextUrl.searchParams.get("formato") === "pdf" ? "pdf" : "xlsx";
  const period = request.nextUrl.searchParams.get("periodo") ?? "30d";
  const { orders, range } = await reportOrders({ period, businessId: business.id, withItems: true });
  const data = {
    title: `Reporte de ventas · ${business.trade_name}`,
    from: range.from,
    to: range.to,
    summary: summarize(orders),
    series: salesSeries(orders, range.from, range.to, range.granularity),
    top: topProducts(orders, 15),
  };
  const filename = `reporte-${business.slug}-${range.from}_${range.to}.${format}`;
  const body = format === "pdf" ? await reportToPdf(data) : await reportToExcel(data);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type":
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
