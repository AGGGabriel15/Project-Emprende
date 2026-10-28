"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form-controls";
import { PhoneInput } from "@/components/ui/masked-inputs";
import { saveAddress } from "@/features/account/actions";
import { useLocation } from "@/features/location/store";
import { addressSchema, type AddressInput } from "@/lib/validations/profile";
import type { Address } from "@/types/domain";
import { LocationSelects } from "./location-selects";

export function AddressForm({
  address,
  defaults,
  onSaved,
}: {
  address?: Address;
  defaults?: { recipientName?: string; phone?: string };
  onSaved: (address: Address) => void;
}) {
  const visitor = useLocation();
  const form = useForm<AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: address
      ? {
          label: address.label,
          departmentId: address.department_id,
          municipalityId: address.municipality_id,
          addressLine: address.address_line,
          recipientName: address.recipient_name,
          phone: address.phone,
          isDefault: address.is_default,
        }
      : {
          label: "Casa",
          departmentId: visitor.departmentId ?? 0,
          municipalityId: visitor.municipalityId ?? 0,
          addressLine: "",
          recipientName: defaults?.recipientName ?? "",
          phone: defaults?.phone ?? "",
          isDefault: false,
        },
  });
  const { errors, isSubmitting } = form.formState;
  const [departmentId, municipalityId] = useWatch({
    control: form.control,
    name: ["departmentId", "municipalityId"],
  });

  const submit = form.handleSubmit(async (values) => {
    const result = await saveAddress(values, address?.id);
    if (!result.ok) return void toast.error(result.error);
    toast.success(address ? "Dirección actualizada." : "Dirección guardada.");
    onSaved(result.data);
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Nombre de la dirección" htmlFor="addr-label" error={errors.label?.message}>
        <Input id="addr-label" placeholder="Casa, Trabajo…" {...form.register("label")} />
      </Field>
      <LocationSelects
        idPrefix="addr"
        departmentId={Number(departmentId) || null}
        municipalityId={Number(municipalityId) || null}
        errors={{
          departmentId: errors.departmentId?.message,
          municipalityId: errors.municipalityId?.message,
        }}
        onChange={(value) => {
          form.setValue("departmentId", value.departmentId);
          form.setValue("municipalityId", value.municipalityId);
        }}
      />
      <Field
        label="Dirección"
        htmlFor="addr-line"
        error={errors.addressLine?.message}
        hint='Barrio y punto de referencia, p. ej. "De la iglesia 2 c. al sur, casa verde".'
      >
        <Textarea id="addr-line" rows={3} {...form.register("addressLine")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="¿Quién recibe?" htmlFor="addr-recipient" error={errors.recipientName?.message}>
          <Input id="addr-recipient" autoComplete="name" {...form.register("recipientName")} />
        </Field>
        <Field label="Teléfono" htmlFor="addr-phone" error={errors.phone?.message}>
          <Controller
            control={form.control}
            name="phone"
            render={({ field }) => (
              <PhoneInput id="addr-phone" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={Boolean(errors.phone)} />
            )}
          />
        </Field>
      </div>
      <Checkbox label="Usar como dirección principal" {...form.register("isDefault")} />
      <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
        Guardar dirección
      </Button>
    </form>
  );
}
