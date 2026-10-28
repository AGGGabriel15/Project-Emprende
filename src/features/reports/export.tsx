import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import ExcelJS from "exceljs";
import { formatMoney, formatPercent } from "@/lib/utils";
import type { salesSeries, summarize, topProducts } from "./compute";

export type ReportData = {
  title: string;
  from: string;
  to: string;
  summary: ReturnType<typeof summarize>;
  series: ReturnType<typeof salesSeries>;
  top: ReturnType<typeof topProducts>;
};

function summaryRows(data: ReportData): [string, string][] {
  const s = data.summary;
  return [
    ["Pedidos vendidos", String(s.orders)],
    ["Ventas de productos", formatMoney(s.gross)],
    ["Envíos", formatMoney(s.delivery)],
    ["Comisión", formatMoney(s.commission)],
    ["Neto", formatMoney(s.net)],
    ["Ticket promedio", formatMoney(s.avgTicket)],
    ["Cancelados", `${s.cancelled} (${formatPercent(s.cancellationRate)})`],
  ];
}

export async function reportToExcel(data: ReportData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Catarina Market";
  const summary = workbook.addWorksheet("Resumen");
  summary.addRow([data.title]).font = { bold: true, size: 14 };
  summary.addRow([`Del ${data.from} al ${data.to}`]);
  summary.addRow([]);
  for (const row of summaryRows(data)) summary.addRow(row);
  summary.getColumn(1).width = 26;
  summary.getColumn(2).width = 22;

  const series = workbook.addWorksheet("Ventas");
  series.addRow(["Período", "Pedidos", "Ventas (C$)"]).font = { bold: true };
  for (const p of data.series) series.addRow([p.key, p.orders, p.sales / 100]);
  series.getColumn(3).numFmt = "#,##0.00";
  series.columns.forEach((c) => (c.width = 16));

  const top = workbook.addWorksheet("Productos");
  top.addRow(["Producto", "Unidades", "Ingresos (C$)"]).font = { bold: true };
  for (const p of data.top) top.addRow([p.name, p.quantity, p.revenue / 100]);
  top.getColumn(1).width = 40;
  top.getColumn(3).numFmt = "#,##0.00";

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1d3a2f" },
  brand: { fontSize: 11, color: "#c8812d", marginBottom: 4 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  muted: { color: "#6b7a72", marginBottom: 16 },
  section: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 6 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e3e6dc", paddingVertical: 4 },
  cell: { flex: 1 },
  right: { flex: 1, textAlign: "right" },
  head: { fontFamily: "Helvetica-Bold" },
});

function ReportDocument({ data }: { data: ReportData }) {
  return (
    <Document title={data.title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>Catarina Market</Text>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.muted}>
          Del {data.from} al {data.to}
        </Text>
        <Text style={styles.section}>Resumen</Text>
        {summaryRows(data).map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.cell}>{label}</Text>
            <Text style={styles.right}>{value}</Text>
          </View>
        ))}
        <Text style={styles.section}>Ventas por período</Text>
        <View style={[styles.row, styles.head]}>
          <Text style={styles.cell}>Período</Text>
          <Text style={styles.right}>Pedidos</Text>
          <Text style={styles.right}>Ventas</Text>
        </View>
        {data.series
          .filter((p) => p.orders > 0)
          .map((p) => (
            <View key={p.key} style={styles.row}>
              <Text style={styles.cell}>{p.key}</Text>
              <Text style={styles.right}>{p.orders}</Text>
              <Text style={styles.right}>{formatMoney(p.sales)}</Text>
            </View>
          ))}
        <Text style={styles.section}>Productos más vendidos</Text>
        {data.top.map((p) => (
          <View key={p.name} style={styles.row}>
            <Text style={[styles.cell, { flex: 3 }]}>{p.name}</Text>
            <Text style={styles.right}>{p.quantity} u.</Text>
            <Text style={styles.right}>{formatMoney(p.revenue)}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function reportToPdf(data: ReportData) {
  return renderToBuffer(<ReportDocument data={data} />);
}
