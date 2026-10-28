"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { requestPasswordReset, updatePassword } from "@/features/auth/actions";
import { newPasswordSchema, resetSchema } from "@/lib/validations/auth";

export function PasswordResetForm() {
  const [sent, setSent] = useState(false);
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: "" },
  });
  const submit = form.handleSubmit(async (values) => {
    const result = await requestPasswordReset(values);
    if (!result.ok) return void toast.error(result.error);
    setSent(true);
  });
  if (sent) {
    return (
      <p className="rounded-xl bg-success-soft p-4 text-center text-sm">
        Si existe una cuenta con ese correo, te llegará un enlace en unos minutos.
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Correo" htmlFor="email" error={form.formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
        Enviar enlace
      </Button>
    </form>
  );
}

export function NewPasswordForm() {
  const router = useRouter();
  const form = useForm<z.infer<typeof newPasswordSchema>>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async (values) => {
    const result = await updatePassword(values);
    if (!result.ok) return void toast.error(result.error);
    toast.success("Contraseña actualizada.");
    router.replace("/cuenta");
  });
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Nueva contraseña" htmlFor="password" error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field label="Repite la contraseña" htmlFor="confirm" error={errors.confirm?.message}>
        <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Guardar contraseña
      </Button>
    </form>
  );
}
