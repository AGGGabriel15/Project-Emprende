"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { LocationSelects } from "@/components/customer/location-selects";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { PhoneInput } from "@/components/ui/masked-inputs";
import { SingleImageUploader } from "@/components/upload/uploaders";
import { updateBusinessSettings } from "@/features/businesses/actions";
import { businessSettingsSchema } from "@/lib/validations/business";
import type { Business, PlatformCategory } from "@/types/domain";

type Values = z.input<typeof businessSettingsSchema>;

export function BusinessSettingsForm({ business, categories }: { business: Business; categories: PlatformCategory[] }) {
  const router = useRouter();
  const form = useForm<Values>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: {
      tradeName: business.trade_name,
      categoryId: business.category_id ?? 0,
      description: business.description,
      departmentId: business.department_id ?? 0,
      municipalityId: business.municipality_id ?? 0,
      addressLine: business.address_line ?? "",
      phone: business.phone ?? "",
      whatsapp: business.whatsapp ?? "",
      logoUrl: business.logo_url ?? "",
      coverUrl: business.cover_url ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const [departmentId, municipalityId, logoUrl, coverUrl] = useWatch({
    control: form.control,
    name: ["departmentId", "municipalityId", "logoUrl", "coverUrl"],
  });

  const submit = form.handleSubmit(async (values) => {
    const result = await updateBusinessSettings(values);
    if (!result.ok) return void toast.error(result.error);
    toast.success("Datos del negocio guardados.");
    router.refresh();
  });

  return (
    <form onSubmit={submit} noValidate>
      <Card>
        <CardHeader title="Perfil público" description="Lo que ven los clientes en tu página." />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <Field label="Logo">
              <SingleImageUploader label="Subir logo" value={logoUrl} onChange={(url) => form.setValue("logoUrl", url, { shouldDirty: true })} />
            </Field>
            <Field label="Portada">
              <SingleImageUploader label="Subir portada" aspect="aspect-[2.4/1]" value={coverUrl} onChange={(url) => form.setValue("coverUrl", url, { shouldDirty: true })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre comercial" htmlFor="tradeName" error={errors.tradeName?.message}>
              <Input id="tradeName" {...form.register("tradeName")} />
            </Field>
            <Field label="Categoría principal" htmlFor="categoryId" error={errors.categoryId?.message}>
              <Select id="categoryId" {...form.register("categoryId")}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Descripción" htmlFor="description" error={errors.description?.message}>
            <Textarea id="description" rows={4} {...form.register("description")} />
          </Field>
          <LocationSelects
            idPrefix="settings"
            departmentId={Number(departmentId) || null}
            municipalityId={Number(municipalityId) || null}
            errors={{ departmentId: errors.departmentId?.message, municipalityId: errors.municipalityId?.message }}
            onChange={(value) => {
              form.setValue("departmentId", value.departmentId);
              form.setValue("municipalityId", value.municipalityId);
            }}
          />
          <Field label="Dirección del local" htmlFor="addressLine" error={errors.addressLine?.message}>
            <Input id="addressLine" {...form.register("addressLine")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Teléfono" htmlFor="phone" error={errors.phone?.message}>
              <Controller
            control={form.control}
            name="phone"
            render={({ field }) => (
              <PhoneInput id="phone" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={Boolean(errors.phone)} />
            )}
          />
            </Field>
            <Field label="WhatsApp" htmlFor="whatsapp" error={errors.whatsapp?.message}>
              <Controller
            control={form.control}
            name="whatsapp"
            render={({ field }) => (
              <PhoneInput id="whatsapp" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={Boolean(errors.whatsapp)} />
            )}
          />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting}>
              Guardar cambios
            </Button>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
