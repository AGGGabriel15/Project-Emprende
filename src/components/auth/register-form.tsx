"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FieldError, Input } from "@/components/ui/form-controls";
import { signUp } from "@/features/auth/actions";
import { registerSchema } from "@/lib/validations/auth";

type Values = z.input<typeof registerSchema>;

export function RegisterForm({ next }: { next?: string }) {
  const router = useRouter();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", acceptTerms: false as unknown as true },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    const result = await signUp(values, next);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.data.needsConfirmation) {
      setSentTo(values.email);
      return;
    }
    router.replace(result.data.redirectTo!);
    router.refresh();
  });

  if (sentTo) {
    return (
      <div className="text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
          <MailCheck className="size-6" />
        </div>
        <p className="mt-4 font-semibold">Revisa tu correo</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Enviamos un enlace de confirmación a <strong>{sentTo}</strong>. Ábrelo para activar tu cuenta.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Nombre completo" htmlFor="fullName" error={errors.fullName?.message}>
        <Input id="fullName" autoComplete="name" {...form.register("fullName")} />
      </Field>
      <Field label="Correo" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
      </Field>
      <Field
        label="Contraseña"
        htmlFor="password"
        error={errors.password?.message}
        hint="Mínimo 8 caracteres, con letras y números."
      >
        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <div>
        <Checkbox
          {...form.register("acceptTerms")}
          label={
            <>
              Acepto los{" "}
              <Link href="/terminos" target="_blank" className="text-primary underline">
                términos
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
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Crear cuenta
      </Button>
    </form>
  );
}
