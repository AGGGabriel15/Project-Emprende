"use client";

import { CreditCard, LockKeyhole } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DemoPayment() {
  const orderId = useSearchParams().get("pedido");
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pay = async () => {
    if (!orderId) return;
    setLoading(true);
    setError("");
    const response = await fetch("/api/pagos/simular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error?.message ?? "No se pudo completar el pago.");
      setLoading(false);
      return;
    }
    router.push(`/checkout/exito?pedido=${orderId}`);
  };
  return (
    <div className="rounded-[2rem] border bg-white p-8 shadow-xl shadow-[#174936]/5">
      <div className="mb-6 flex items-center justify-between">
        <span className="grid size-12 place-items-center rounded-full bg-[#e8efe8] text-[#236b4e]">
          <CreditCard />
        </span>
        <span className="flex items-center gap-1 text-xs font-bold text-[#65736b]">
          <LockKeyhole size={14} /> DEMO SEGURA
        </span>
      </div>
      <h1 className="text-4xl font-bold">Simulación de pago</h1>
      <p className="mt-3 text-sm leading-6 text-[#65736b]">
        Este entorno académico no realiza cargos reales. Al confirmar se marcará
        el pedido como pagado y se descontará el inventario reservado.
      </p>
      <div className="my-7 rounded-xl bg-[#f7f7f3] p-4 text-sm">
        <p className="text-xs font-bold text-[#75837b] uppercase">Pedido</p>
        <p className="mt-1 font-mono">{orderId ?? "No disponible"}</p>
      </div>
      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button className="w-full" onClick={pay} disabled={!orderId || loading}>
        {loading ? "Procesando..." : "Confirmar pago de prueba"}
      </Button>
    </div>
  );
}
