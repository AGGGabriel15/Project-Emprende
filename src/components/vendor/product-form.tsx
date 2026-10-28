"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Switch } from "@/components/ui/switch";
import { ImagesUploader } from "@/components/upload/uploaders";
import { saveProduct } from "@/features/businesses/actions";
import { productSchema, type ProductInput } from "@/lib/validations/catalog";
import type { Product, ProductCategory } from "@/types/domain";

export function ProductForm({ product, categories }: { product?: Product; categories: ProductCategory[] }) {
  const router = useRouter();
  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? "",
      description: product?.description ?? "",
      categoryId: product?.category_id ?? "",
      material: product?.material ?? "",
      dimensions: product?.dimensions ?? "",
      weightGrams: product?.weight_grams ?? undefined,
      price: product ? product.price_minor / 100 : undefined,
      stock: product?.stock ?? 1,
      isActive: product?.is_active ?? true,
      images: product?.images ?? [],
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    const result = await saveProduct(values, product?.id);
    if (!result.ok) return void toast.error(result.error);
    toast.success(product ? "Producto actualizado." : "Producto creado.");
    router.push("/vendedor/productos");
    router.refresh();
  });

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]" noValidate>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Información" />
          <CardBody className="space-y-4">
            <Field label="Nombre" htmlFor="name" error={errors.name?.message}>
              <Input id="name" placeholder="Jarrón de barro pintado a mano" {...form.register("name")} />
            </Field>
            <Field label="Descripción" htmlFor="description" error={errors.description?.message}>
              <Textarea id="description" rows={5} {...form.register("description")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Material" htmlFor="material" error={errors.material?.message}>
                <Input id="material" placeholder="Barro, bambú…" {...form.register("material")} />
              </Field>
              <Field label="Medidas" htmlFor="dimensions" error={errors.dimensions?.message}>
                <Input id="dimensions" placeholder="30 × 15 cm" {...form.register("dimensions")} />
              </Field>
              <Field label="Peso (gramos)" htmlFor="weightGrams" error={errors.weightGrams?.message}>
                <Input id="weightGrams" type="number" min={0} {...form.register("weightGrams")} />
              </Field>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Fotos" description="Hasta 6. La primera es la portada." />
          <CardBody>
            <Controller
              control={form.control}
              name="images"
              render={({ field }) => <ImagesUploader value={field.value} onChange={field.onChange} />}
            />
            {errors.images?.message && <p className="mt-2 text-xs text-destructive">{errors.images.message}</p>}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader title="Venta" />
          <CardBody className="space-y-4">
            <Field label="Precio (C$)" htmlFor="price" error={errors.price?.message}>
              <Input id="price" type="number" min={0} step="0.01" inputMode="decimal" {...form.register("price")} />
            </Field>
            <Field label="Stock disponible" htmlFor="stock" error={errors.stock?.message} hint="Con 0 se muestra como Agotado.">
              <Input id="stock" type="number" min={0} {...form.register("stock")} />
            </Field>
            <Field label="Categoría de tu catálogo" htmlFor="categoryId" hint={<Link href="/vendedor/categorias" className="text-primary underline">Administrar categorías</Link>}>
              <Select id="categoryId" {...form.register("categoryId")}>
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} label="Visible en la tienda" description="Desactívalo para ocultarlo sin borrarlo." />
              )}
            />
          </CardBody>
        </Card>
        <div className="flex gap-3">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/vendedor/productos">Cancelar</Link>
          </Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            Guardar
          </Button>
        </div>
      </div>
    </form>
  );
}
