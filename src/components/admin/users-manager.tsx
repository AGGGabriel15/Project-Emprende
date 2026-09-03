"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clientApi } from "@/lib/client-api";
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
};

export function UsersManager() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["users"],
    queryFn: () => clientApi<User[]>("/api/usuarios"),
  });
  const mutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      clientApi(`/api/usuarios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["users"] }),
  });
  return (
    <>
      <p className="text-sm font-bold tracking-widest text-[#c87724] uppercase">
        Administración
      </p>
      <h1 className="mt-2 mb-8 text-5xl font-bold">Usuarios</h1>
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-[#edf2eb] text-xs uppercase">
            <tr>
              <th className="p-4">Usuario</th>
              <th className="p-4">Rol</th>
              <th className="p-4">Registro</th>
              <th className="p-4">Estado</th>
              <th className="p-4">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {query.data?.map((user) => (
              <tr key={user.id}>
                <td className="p-4">
                  <strong>{user.name}</strong>
                  <span className="block text-xs text-[#65736b]">
                    {user.email}
                  </span>
                </td>
                <td className="p-4 capitalize">{user.role}</td>
                <td className="p-4">
                  {new Intl.DateTimeFormat("es-NI").format(
                    new Date(user.createdAt),
                  )}
                </td>
                <td className="p-4">
                  <Badge tone={user.active ? "green" : "red"}>
                    {user.active ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
                <td className="p-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      mutation.mutate({ id: user.id, active: !user.active })
                    }
                  >
                    {user.active ? "Desactivar" : "Activar"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {query.isLoading && <p className="p-6">Cargando…</p>}
        {query.error && (
          <p className="p-6 text-red-700">{query.error.message}</p>
        )}
      </div>
    </>
  );
}
