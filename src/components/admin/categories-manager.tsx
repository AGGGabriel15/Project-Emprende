"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { clientApi } from "@/lib/client-api";
type Category = { id: string; name: string; slug: string };

export function CategoriesManager() {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["categories"],
    queryFn: () => clientApi<Category[]>("/api/categorias"),
  });
  const create = useMutation({
    mutationFn: () =>
      clientApi("/api/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      setName("");
      setError("");
      client.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (reason) => setError(reason.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      clientApi(`/api/categorias/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["categories"] }),
    onError: (reason) => setError(reason.message),
  });
  const rename = (category: Category) => {
    const next = window.prompt("Nuevo nombre:", category.name);
    if (!next) return;
    clientApi(`/api/categorias/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    })
      .then(() => client.invalidateQueries({ queryKey: ["categories"] }))
      .catch((reason) => setError(reason.message));
  };
  return (
    <>
      <p className="text-sm font-bold tracking-widest text-[#c87724] uppercase">
        Catálogo
      </p>
      <h1 className="mt-2 mb-8 text-5xl font-bold">Categorías</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
        className="mb-6 flex max-w-2xl gap-3 rounded-2xl border bg-white p-4"
      >
        <Input
          className="mt-0"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nombre de la categoría"
        />
        <Button
          type="submit"
          disabled={name.trim().length < 2 || create.isPending}
        >
          Agregar
        </Button>
      </form>
      {error && (
        <p className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="space-y-3">
        {query.data?.map((category) => (
          <div
            key={category.id}
            className="flex items-center justify-between gap-4 rounded-2xl border bg-white p-5"
          >
            <div>
              <strong>{category.name}</strong>
              <span className="ml-3 font-mono text-xs text-[#75837b]">
                /{category.slug}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => rename(category)}
              >
                Renombrar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-700"
                onClick={() => remove.mutate(category.id)}
              >
                Eliminar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
