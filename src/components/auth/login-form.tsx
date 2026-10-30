"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { signIn } from "@/features/auth/actions";
import { loginSchema } from "@/lib/validations/auth";
import { forgetBrowserSession } from "@/lib/supabase/client";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    forgetBrowserSession();
    const result = await signIn(values, next);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.replace(result.data.redirectTo);
    router.refresh();
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Correo" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email) || undefined} {...form.register("email")} />
      </Field>
      <Field
        label={
          <span className="flex justify-between">
            Contraseña
            <Link href="/recuperar" className="font-normal text-primary hover:underline">
              ¿La olvidaste?
            </Link>
          </span>
        }
        htmlFor="password"
        error={errors.password?.message}
      >
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.password) || undefined} {...form.register("password")} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Entrar
      </Button>
    </form>
  );
}
