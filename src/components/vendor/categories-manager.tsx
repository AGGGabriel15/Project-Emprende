"use client";

import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form-controls";
import {
  deleteProductCategory,
  reorderProductCategories,
  saveProductCategory,
} from "@/features/businesses/actions";
import type { ProductCategory } from "@/types/domain";

export function CategoriesManager({ categories, counts }: { categories: ProductCategory[]; counts: Record<string, number> }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) return void toast.error(result.error);
      after?.();
      router.refresh();
    });

  function move(index: number, delta: number) {
    const ids = categories.map((c) => c.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved);
    run(() => reorderProductCategories(ids));
  }

  return (
    <Card>
      <form
        className="flex gap-2 border-b p-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveProductCategory({ name }), () => setName(""));
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva categoría (p. ej. Jarrones)" aria-label="Nombre de la categoría" />
        <Button type="submit" disabled={name.trim().length < 2} loading={pending}>
          <Plus /> Agregar
        </Button>
      </form>
      <ul className="divide-y">
        {categories.map((category, index) => (
          <li key={category.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex flex-col">
              <button type="button" className="cursor-pointer text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={index === 0 || pending} onClick={() => move(index, -1)} aria-label="Subir">
                <ArrowUp className="size-4" />
              </button>
              <button type="button" className="cursor-pointer text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={index === categories.length - 1 || pending} onClick={() => move(index, 1)} aria-label="Bajar">
                <ArrowDown className="size-4" />
              </button>
            </div>
            {editing?.id === category.id ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => saveProductCategory({ name: editing.name }, category.id), () => setEditing(null));
                }}
              >
                <Input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-9" />
                <Button type="submit" size="icon" className="size-9" aria-label="Guardar"><Check /></Button>
                <Button type="button" variant="ghost" size="icon" className="size-9" aria-label="Cancelar" onClick={() => setEditing(null)}><X /></Button>
              </form>
            ) : (
              <>
                <p className="flex-1 font-medium">
                  {category.name}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">{counts[category.id] ?? 0} productos</span>
                </p>
                <Button variant="ghost" size="icon" className="size-9" aria-label="Renombrar" onClick={() => setEditing({ id: category.id, name: category.name })}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 text-destructive"
                  aria-label="Eliminar"
                  onClick={() =>
                    confirm(`¿Eliminar “${category.name}”? Sus productos quedarán sin categoría.`) &&
                    run(() => deleteProductCategory(category.id))
                  }
                >
                  <Trash2 />
                </Button>
              </>
            )}
          </li>
        ))}
        {categories.length === 0 && (
          <li className="p-8 text-center text-sm text-muted-foreground">Crea tu primera categoría arriba.</li>
        )}
      </ul>
    </Card>
  );
}
