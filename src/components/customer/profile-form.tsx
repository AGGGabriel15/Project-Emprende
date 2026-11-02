"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Checkbox, Field, FieldError, Input } from "@/components/ui/form-controls";
import { CedulaInput, PhoneInput } from "@/components/ui/masked-inputs";
import { updateProfile } from "@/features/account/actions";
import { useLocation } from "@/features/location/store";
import { profileSchema } from "@/lib/validations/profile";
import type { Profile } from "@/types/domain";
import { LocationSelects } from "./location-selects";

type Values = z.input<typeof profileSchema>;

export function ProfileForm({
  profile,
  redirectTo,
  submitLabel = "Guardar cambios",
}: {
  profile: Profile;
  redirectTo?: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const visitor = useLocation();
  // Quien entró con Google aún no aceptó los términos: se piden aquí (Ley 787).
  const needsConsent = !profile.accepted_terms_at;
  const form = useForm<Values>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile.full_name,
      phone: profile.phone ?? "",
      cedula: profile.cedula ?? "",
      departmentId: profile.department_id ?? visitor.departmentId ?? 0,
      municipalityId: profile.municipality_id ?? visitor.municipalityId ?? 0,
      acceptTerms: false,
    },
    mode: "onTouched",
  });
  const { errors, isSubmitting } = form.formState;
  const municipalityId = useWatch({ control: form.control, name: "municipalityId" });

  const submit = form.handleSubmit(async (values) => {
    if (needsConsent && !values.acceptTerms) {
      form.setError("acceptTerms", { message: "Debes aceptar los términos y el aviso de privacidad." });
      return;
    }
    const result = await updateProfile(values);
    if (!result.ok) return void toast.error(result.error);
    visitor.setLocation(Number(values.departmentId), Number(values.municipalityId));
    toast.success("Perfil guardado.");
    if (redirectTo) router.replace(redirectTo);
    router.refresh();
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Nombre completo" htmlFor="fullName" error={errors.fullName?.message}>
        <Input id="fullName" autoComplete="name" {...form.register("fullName")} />
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
        <Field label="Cédula (opcional)" htmlFor="cedula" error={errors.cedula?.message}>
          <CedulaInput id="cedula" {...form.register("cedula")} />
        </Field>
      </div>
      <Controller
        control={form.control}
        name="departmentId"
        render={({ field }) => (
          <LocationSelects
            idPrefix="profile"
            departmentId={Number(field.value) || null}
            municipalityId={Number(municipalityId) || null}
            errors={{
              departmentId: errors.departmentId?.message,
              municipalityId: errors.municipalityId?.message,
            }}
            onChange={(value) => {
              field.onChange(value.departmentId);
              form.setValue("municipalityId", value.municipalityId, { shouldValidate: form.formState.isSubmitted });
            }}
          />
        )}
      />
      {needsConsent && (
        <div>
          <Checkbox
            {...form.register("acceptTerms")}
            label={
              <>
                Acepto los{" "}
                <Link href="/terminos" target="_blank" className="text-primary underline">
                  términos y condiciones
                </Link>{" "}
                y el{" "}
                <Link href="/privacidad" target="_blank" className="text-primary underline">
                  aviso de privacidad
                </Link>{" "}
                (Ley 787 de Protección de Datos Personales).
              </>
            }
          />
          <FieldError>{errors.acceptTerms?.message}</FieldError>
        </div>
      )}
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
