"use client";

import { Pencil, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ProductImage } from "@/components/catalog/product-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form-controls";
import { Switch } from "@/components/ui/switch";
import { deleteProduct, setProductActive, updateStock } from "@/features/businesses/actions";
import { formatMoney } from "@/lib/utils";
import type { Product, ProductCategory } from "@/types/domain";

export function ProductsTable({ products, categories }: { products: Product[]; categories: ProductCategory[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [, startTransition] = useTransition();

  const visible = useMemo(
    () =>
      products.filter((p) => {
        if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
        if (filter === "active") return p.is_active;
        if (filter === "inactive") return !p.is_active;
        if (filter === "low") return p.stock <= 3;
        if (filter !== "all") return p.category_id === filter;
        return true;
      }),
    [products, query, filter],
  );

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, message: string) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) return void toast.error(result.error);
      toast.success(message);
      router.refresh();
    });

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto…"
            className="h-10 w-full rounded-xl border bg-card pr-3 pl-9 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 sm:w-56" aria-label="Filtrar">
          <option value="all">Todos ({products.length})</option>
          <option value="active">Visibles</option>
          <option value="inactive">Ocultos</option>
          <option value="low">Stock bajo (≤ 3)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <ul className="divide-y">
        {visible.map((product) => (
          <li key={product.id} className="flex flex-wrap items-center gap-4 p-4">
            <ProductImage src={product.images[0]} alt="" className="size-14 shrink-0 rounded-xl" sizes="56px" />
            <div className="min-w-0 flex-1">
              <Link href={`/vendedor/productos/${product.id}`} className="font-medium hover:text-primary">
                {product.name}
              </Link>
              <p className="text-sm text-muted-foreground">
                {formatMoney(product.price_minor)} · {categories.find((c) => c.id === product.category_id)?.name ?? "Sin categoría"}
              </p>
              <div className="mt-1 flex gap-1.5">
                {product.stock === 0 ? (
                  <Badge tone="red">Agotado</Badge>
                ) : product.stock <= 3 ? (
                  <Badge tone="amber">Stock bajo</Badge>
                ) : null}
                {!product.is_active && <Badge tone="gray">Oculto</Badge>}
                {product.review_status === "pending" && <Badge tone="blue">En revisión</Badge>}
                {product.review_status === "rejected" && <Badge tone="red">Con observaciones</Badge>}
              </div>
              {product.review_status === "rejected" && product.review_note && (
                <p className="mt-1 text-xs text-destructive">Corrige: {product.review_note}</p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Stock</span>
              <input
                type="number"
                min={0}
                defaultValue={product.stock}
                key={product.stock}
                onBlur={(e) => {
                  const value = Number(e.target.value);
                  if (value !== product.stock) run(() => updateStock(product.id, value), "Stock actualizado.");
                }}
                className="h-9 w-20 rounded-lg border bg-card px-2 text-sm tabular-nums focus:border-primary focus:outline-none"
                aria-label={`Stock de ${product.name}`}
              />
            </label>
            <div className="flex items-center gap-2">
              <Switch
                checked={product.is_active}
                onCheckedChange={(checked) =>
                  run(() => setProductActive(product.id, checked), checked ? "Producto visible." : "Producto oculto.")
                }
              />
              <Button asChild variant="ghost" size="icon" aria-label="Editar">
                <Link href={`/vendedor/productos/${product.id}`}>
                  <Pencil />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                aria-label="Eliminar"
                onClick={() =>
                  confirm(`¿Eliminar “${product.name}”? Los pedidos anteriores conservan su copia.`) &&
                  run(() => deleteProduct(product.id), "Producto eliminado.")
                }
              >
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
        {visible.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">Sin resultados.</li>}
      </ul>
    </Card>
  );
}
