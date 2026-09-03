"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { clientApi } from "@/lib/client-api";
import { formatMoney } from "@/lib/utils";
type Product = {
  id: string;
  name: string;
  priceMinor: number;
  stock: number;
  entrepreneur: { businessName: string };
  category: { name: string };
};

export function AdminProductsManager() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => clientApi<Product[]>("/api/productos?limit=48"),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      clientApi(`/api/productos/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin-products"] }),
  });
  return (
    <>
      <p className="text-sm font-bold tracking-widest text-[#c87724] uppercase">
        Moderación
      </p>
      <h1 className="mt-2 mb-8 text-5xl font-bold">Productos</h1>
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-[#edf2eb] text-xs uppercase">
            <tr>
              <th className="p-4">Producto</th>
              <th className="p-4">Emprendedor</th>
              <th className="p-4">Categoría</th>
              <th className="p-4">Precio</th>
              <th className="p-4">Inventario</th>
              <th className="p-4">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {query.data?.map((product) => (
              <tr key={product.id}>
                <td className="p-4 font-bold">{product.name}</td>
                <td className="p-4">{product.entrepreneur.businessName}</td>
                <td className="p-4">{product.category.name}</td>
                <td className="p-4">{formatMoney(product.priceMinor)}</td>
                <td className="p-4">{product.stock}</td>
                <td className="p-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-700"
                    onClick={() => {
                      if (window.confirm("¿Ocultar este producto?"))
                        remove.mutate(product.id);
                    }}
                  >
                    Ocultar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
