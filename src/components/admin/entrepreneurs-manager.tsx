"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clientApi } from "@/lib/client-api";
type Entrepreneur = {
  id: string;
  businessName: string;
  description: string;
  phone: string;
  address: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  user: { name: string; email: string };
};

export function EntrepreneursManager() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["entrepreneurs"],
    queryFn: () => clientApi<Entrepreneur[]>("/api/emprendedores"),
  });
  const mutation = useMutation({
    mutationFn: ({
      id,
      status,
      rejectionReason,
    }: {
      id: string;
      status: "approved" | "rejected";
      rejectionReason?: string;
    }) =>
      clientApi(`/api/emprendedores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejectionReason }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["entrepreneurs"] }),
  });
  const reject = (id: string) => {
    const reason = window.prompt("Motivo del rechazo:");
    if (reason)
      mutation.mutate({ id, status: "rejected", rejectionReason: reason });
  };
  return (
    <>
      <p className="text-sm font-bold tracking-widest text-[#c87724] uppercase">
        Comunidad
      </p>
      <h1 className="mt-2 mb-8 text-5xl font-bold">Emprendedores</h1>
      <div className="grid gap-5 lg:grid-cols-2">
        {query.data?.map((item) => (
          <article key={item.id} className="rounded-2xl border bg-white p-6">
            <div className="flex justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">{item.businessName}</h2>
                <p className="text-sm text-[#65736b]">
                  {item.user.name} · {item.user.email}
                </p>
              </div>
              <Badge
                tone={
                  item.status === "approved"
                    ? "green"
                    : item.status === "rejected"
                      ? "red"
                      : "amber"
                }
              >
                {item.status}
              </Badge>
            </div>
            <p className="mt-4 text-sm leading-6">{item.description}</p>
            <p className="mt-3 text-xs text-[#65736b]">
              {item.phone} · {item.address}
            </p>
            {item.rejectionReason && (
              <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                {item.rejectionReason}
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  mutation.mutate({ id: item.id, status: "approved" })
                }
              >
                Aprobar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => reject(item.id)}
              >
                Rechazar
              </Button>
            </div>
          </article>
        ))}
        {query.isLoading && <p>Cargando…</p>}
        {query.error && <p className="text-red-700">{query.error.message}</p>}
      </div>
    </>
  );
}
