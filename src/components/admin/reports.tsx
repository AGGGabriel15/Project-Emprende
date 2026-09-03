"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { clientApi } from "@/lib/client-api";
import { formatMoney } from "@/lib/utils";

type Report = {
  summary: {
    salesMinor: number;
    orders: number;
    averageTicketMinor: number;
    users: number;
    products: number;
  };
  byDay: Array<{ date: string; salesMinor: number; orders: number }>;
  byCategory: Array<{ name: string; salesMinor: number }>;
  byEntrepreneur: Array<{ name: string; salesMinor: number; orders: number }>;
};
const tooltipFormatter = (
  value: number | string | readonly (number | string)[] | undefined,
) => formatMoney(Number(Array.isArray(value) ? value[0] : (value ?? 0)));

export function Reports() {
  const query = useQuery({
    queryKey: ["reports"],
    queryFn: () => clientApi<Report>("/api/reportes"),
  });
  if (query.isLoading) return <p>Cargando reportes…</p>;
  if (query.error)
    return (
      <p className="rounded-xl bg-red-50 p-4 text-red-700">
        {query.error.message}
      </p>
    );
  const data = query.data!;
  return (
    <>
      <div>
        <p className="text-sm font-bold tracking-widest text-[#c87724] uppercase">
          Administración
        </p>
        <h1 className="mt-2 text-5xl font-bold">Resumen de la plataforma</h1>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Ventas", value: formatMoney(data.summary.salesMinor) },
          { label: "Pedidos", value: data.summary.orders },
          {
            label: "Ticket promedio",
            value: formatMoney(data.summary.averageTicketMinor),
          },
          { label: "Usuarios", value: data.summary.users },
          { label: "Productos", value: data.summary.products },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border bg-white p-5">
            <p className="text-xs font-bold text-[#75837b] uppercase">
              {item.label}
            </p>
            <p className="mt-2 font-serif text-2xl font-bold">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="mb-5 text-xl font-bold">Ventas por día</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.byDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={tooltipFormatter} />
                <Line
                  type="monotone"
                  dataKey="salesMinor"
                  stroke="#236b4e"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="mb-5 text-xl font-bold">Ventas por categoría</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byCategory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={tooltipFormatter} />
                <Bar
                  dataKey="salesMinor"
                  fill="#e89c3f"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <section className="mt-6 rounded-2xl border bg-white p-5">
        <h2 className="mb-4 text-xl font-bold">Emprendimientos</h2>
        {data.byEntrepreneur.length ? (
          <div className="divide-y">
            {data.byEntrepreneur.map((row) => (
              <div
                key={row.name}
                className="flex justify-between gap-4 py-3 text-sm"
              >
                <span>
                  {row.name} · {row.orders} pedidos
                </span>
                <strong>{formatMoney(row.salesMinor)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#65736b]">No hay ventas pagadas.</p>
        )}
      </section>
    </>
  );
}
