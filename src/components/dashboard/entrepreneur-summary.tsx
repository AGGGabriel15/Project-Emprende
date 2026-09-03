"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clientApi } from "@/lib/client-api";
import { formatMoney } from "@/lib/utils";

type Profile = {
  businessName: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
};
type Product = { stock: number; active: boolean };
type Order = { paymentStatus: string; totalMinor: number; status: string };

export function EntrepreneurSummary() {
  const profile = useQuery({
    queryKey: ["entrepreneur-profile"],
    queryFn: () => clientApi<Profile>("/api/emprendedores"),
  });
  const products = useQuery({
    queryKey: ["my-products"],
    queryFn: () => clientApi<Product[]>("/api/productos?mine=1&limit=48"),
  });
  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: () => clientApi<Order[]>("/api/pedidos"),
  });
  if (profile.isLoading) return <p>Cargando panel…</p>;
  if (profile.error)
    return (
      <p className="rounded-2xl bg-red-50 p-5 text-red-700">
        {profile.error.message}
      </p>
    );
  const status = profile.data?.status;
  const paidSales =
    orders.data
      ?.filter((order) => order.paymentStatus === "paid")
      .reduce((sum, order) => sum + order.totalMinor, 0) ?? 0;
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm font-bold tracking-widest text-[#c87724] uppercase">
            Panel emprendedor
          </p>
          <h1 className="mt-2 text-5xl font-bold">
            {profile.data?.businessName}
          </h1>
        </div>
        <Badge
          tone={
            status === "approved"
              ? "green"
              : status === "rejected"
                ? "red"
                : "amber"
          }
        >
          {status === "approved"
            ? "Aprobado"
            : status === "rejected"
              ? "Rechazado"
              : "Pendiente de aprobación"}
        </Badge>
      </div>
      {status !== "approved" && (
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <strong>
            Tu solicitud está{" "}
            {status === "rejected" ? "rechazada" : "en revisión"}.
          </strong>
          <p className="mt-1 text-sm">
            {profile.data?.rejectionReason ??
              "Podrás publicar productos cuando un administrador apruebe el negocio."}
          </p>
        </div>
      )}
      <div className="mt-9 grid gap-5 sm:grid-cols-3">
        {[
          { label: "Productos", value: products.data?.length ?? 0 },
          {
            label: "Unidades disponibles",
            value:
              products.data?.reduce((sum, product) => sum + product.stock, 0) ??
              0,
          },
          { label: "Ventas pagadas", value: formatMoney(paidSales) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border bg-white p-6">
            <p className="text-sm text-[#65736b]">{stat.label}</p>
            <p className="mt-2 font-serif text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/dashboard/productos">Gestionar productos</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/pedidos">Ver pedidos</Link>
        </Button>
      </div>
    </>
  );
}
