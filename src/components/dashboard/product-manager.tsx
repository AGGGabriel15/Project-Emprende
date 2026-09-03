"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  FieldError,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui/form-controls";
import { clientApi } from "@/lib/client-api";
import { formatMoney } from "@/lib/utils";
import { productSchema } from "@/validations/product";

type ProductInput = z.infer<typeof productSchema>;
type Product = {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  stock: number;
  images: string[];
  active: boolean;
  category: { id: string; name: string };
};
type Category = { id: string; name: string };
type Profile = { status: "pending" | "approved" | "rejected" };

export function ProductManager() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [serverError, setServerError] = useState("");
  const [uploading, setUploading] = useState(false);
  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      categoryId: "",
      price: 0,
      stock: 0,
      images: [],
      active: true,
    },
  });
  const images = useWatch({ control: form.control, name: "images" }) ?? [];
  const profile = useQuery({
    queryKey: ["entrepreneur-profile"],
    queryFn: () => clientApi<Profile>("/api/emprendedores"),
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => clientApi<Category[]>("/api/categorias"),
  });
  const products = useQuery({
    queryKey: ["my-products"],
    queryFn: () => clientApi<Product[]>("/api/productos?mine=1&limit=48"),
  });
  const save = useMutation({
    mutationFn: (input: ProductInput) =>
      clientApi(editing ? `/api/productos/${editing.id}` : "/api/productos", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-products"] });
      closeForm();
    },
    onError: (error) => setServerError(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      clientApi(`/api/productos/${id}`, { method: "DELETE" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["my-products"] }),
  });
  const closeForm = () => {
    setEditing(null);
    setFormOpen(false);
    setServerError("");
    form.reset({
      name: "",
      description: "",
      categoryId: "",
      price: 0,
      stock: 0,
      images: [],
      active: true,
    });
  };
  const edit = (product: Product) => {
    setEditing(product);
    setFormOpen(true);
    form.reset({
      name: product.name,
      description: product.description,
      categoryId: product.category.id,
      price: product.priceMinor / 100,
      stock: product.stock,
      images: product.images,
      active: product.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setServerError("");
    try {
      const data = new FormData();
      data.append("file", file);
      const result = await clientApi<{ url: string }>(
        "/api/uploads/productos",
        { method: "POST", body: data },
      );
      form.setValue(
        "images",
        [...form.getValues("images"), result.url].slice(0, 5),
        { shouldValidate: true },
      );
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "No se pudo subir la imagen.",
      );
    } finally {
      setUploading(false);
    }
  };
  const approved = profile.data?.status === "approved";
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-widest text-[#c87724] uppercase">
            Tu vitrina
          </p>
          <h1 className="mt-2 text-5xl font-bold">Productos</h1>
        </div>
        <Button
          onClick={() => {
            if (formOpen) closeForm();
            else setFormOpen(true);
          }}
          disabled={!approved}
        >
          <Plus size={18} /> {formOpen ? "Cerrar formulario" : "Nuevo producto"}
        </Button>
      </div>
      {!approved && (
        <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          Necesitas aprobación administrativa antes de publicar.
        </p>
      )}
      {formOpen && approved && (
        <form
          onSubmit={form.handleSubmit((input) => save.mutate(input))}
          className="mt-8 grid gap-5 rounded-[2rem] border bg-white p-7 sm:grid-cols-2"
        >
          <h2 className="text-2xl font-bold sm:col-span-2">
            {editing ? "Editar producto" : "Nuevo producto"}
          </h2>
          <div>
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" {...form.register("name")} />
            <FieldError>{form.formState.errors.name?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="categoryId">Categoría</Label>
            <Select id="categoryId" {...form.register("categoryId")}>
              <option value="">Selecciona una categoría</option>
              {categories.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <FieldError>{form.formState.errors.categoryId?.message}</FieldError>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" {...form.register("description")} />
            <FieldError>
              {form.formState.errors.description?.message}
            </FieldError>
          </div>
          <div>
            <Label htmlFor="price">Precio en córdobas</Label>
            <Input
              id="price"
              type="number"
              min="0.01"
              step="0.01"
              {...form.register("price", { valueAsNumber: true })}
            />
            <FieldError>{form.formState.errors.price?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="stock">Inventario</Label>
            <Input
              id="stock"
              type="number"
              min="0"
              {...form.register("stock", { valueAsNumber: true })}
            />
            <FieldError>{form.formState.errors.stock?.message}</FieldError>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="image">Imágenes (máximo 5)</Label>
            <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed bg-[#f7f7f3] p-5 text-sm font-bold text-[#236b4e]">
              <ImagePlus size={18} />
              {uploading ? "Subiendo..." : "Seleccionar JPG, PNG o WebP"}
              <input
                id="image"
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(event) => upload(event.target.files?.[0])}
              />
            </label>
            <div className="mt-3 flex gap-2">
              {images.map((url) => (
                <div
                  key={url}
                  className="relative size-16 overflow-hidden rounded-lg"
                >
                  <Image
                    src={url}
                    alt="Vista previa"
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
          {serverError && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">
              {serverError}
            </p>
          )}
          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit" disabled={save.isPending || uploading}>
              {save.isPending
                ? "Guardando..."
                : editing
                  ? "Guardar cambios"
                  : "Publicar producto"}
            </Button>
            <Button type="button" variant="ghost" onClick={closeForm}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
      <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.isLoading ? (
          <p>Cargando productos…</p>
        ) : (
          products.data?.map((product) => (
            <article
              key={product.id}
              className="overflow-hidden rounded-2xl border bg-white"
            >
              <div className="relative aspect-[4/3] bg-[#e8efe8]">
                {product.images[0] ? (
                  <Image
                    src={product.images[0]}
                    alt={product.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <span className="grid h-full place-items-center text-4xl">
                    🌿
                  </span>
                )}
              </div>
              <div className="p-5">
                <p className="text-xs font-bold text-[#75837b] uppercase">
                  {product.category.name}
                </p>
                <h3 className="mt-1 text-xl font-bold">{product.name}</h3>
                <div className="mt-3 flex justify-between">
                  <strong>{formatMoney(product.priceMinor)}</strong>
                  <span className="text-sm">{product.stock} uds.</span>
                </div>
                <div className="mt-5 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => edit(product)}
                  >
                    <Pencil size={15} /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-700"
                    onClick={() => {
                      if (window.confirm("¿Ocultar este producto?"))
                        remove.mutate(product.id);
                    }}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </>
  );
}
