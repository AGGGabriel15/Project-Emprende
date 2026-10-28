"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/utils";

type Point = { label: string; value: number; detail?: string };

/** Serie única: un tono (primario), sin leyenda (el título la nombra), tooltip al pasar. */
export function SimpleBarChart({
  data,
  money = true,
  height = 260,
  ariaLabel,
}: {
  data: Point[];
  money?: boolean;
  height?: number;
  ariaLabel: string;
}) {
  const format = (value: number) =>
    money ? formatMoney(value).replace(/\.00$/, "") : value.toLocaleString("es-NI");
  return (
    <div style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={money ? 72 : 32}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickFormatter={format}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
              color: "var(--foreground)",
            }}
            labelStyle={{ color: "var(--muted-foreground)" }}
            formatter={(value, _name, item) => [
              `${format(Number(value))}${(item.payload as Point).detail ? ` · ${(item.payload as Point).detail}` : ""}`,
              money ? "Ventas" : "Pedidos",
            ]}
          />
          <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
