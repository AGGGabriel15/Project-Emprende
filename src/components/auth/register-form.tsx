"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FieldError, Input } from "@/components/ui/form-controls";
import { PasswordChecklist, PasswordInput } from "@/components/ui/password-input";
import { checkEmail, resendConfirmation, signUp } from "@/features/auth/actions";
import { emailSchema, registerSchema } from "@/lib/validations/auth";
import { forgetBrowserSession } from "@/lib/supabase/client";

type Values = z.input<typeof registerSchema>;
type EmailCheck = { email: string; status: "checking" | "available" | "registered" | "unconfirmed"; message?: string | null };

const RESEND_WAIT_S = 60;

export function RegisterForm({ next }: { next?: string }) {
  const router = useRouter();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(registerSchema),
    // Valida al salir de cada campo y, desde ahí, mientras se escribe.
    mode: "onTouched",
    defaultValues: { fullName: "", email: "", password: "", acceptTerms: false as unknown as true },
  });
  const { errors, isSubmitting } = form.formState;
  const email = useWatch({ control: form.control, name: "email" }) ?? "";
  const password = useWatch({ control: form.control, name: "password" }) ?? "";
  const [check, setCheck] = useState<EmailCheck | null>(null);

  // ¿Ya existe una cuenta con este correo? Se consulta al dejar de escribir.
  useEffect(() => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setCheck({ email: parsed.data, status: "checking" });
      const result = await checkEmail(parsed.data);
      if (cancelled || !result.ok || result.data.status === "invalid") return;
      setCheck({ email: parsed.data, status: result.data.status, message: result.data.message });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [email]);

  const current = check && check.email === email.trim().toLowerCase() ? check : null;
  const taken = current?.status === "registered" ? current.message : null;

  const submit = form.handleSubmit(async (values) => {
    if (taken) return;
    forgetBrowserSession();
    const result = await signUp(values, next);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.data.needsConfirmation) {
      setSentTo(values.email.trim().toLowerCase());
      return;
    }
    router.replace(result.data.redirectTo!);
    router.refresh();
  });

  if (sentTo) return <ConfirmationSent email={sentTo} next={next} />;

  const emailError = errors.email?.message ?? taken ?? undefined;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Nombre completo" htmlFor="fullName" error={errors.fullName?.message}>
        <Input id="fullName" autoComplete="name" aria-invalid={Boolean(errors.fullName) || undefined} {...form.register("fullName")} />
      </Field>
      <Field
        label="Correo"
        htmlFor="email"
        error={emailError}
        hint={
          !emailError && current?.status === "unconfirmed"
            ? "Este correo ya se registró pero falta confirmarlo: al continuar te reenviamos el enlace."
            : undefined
        }
      >
        <div className="relative">
          <Input id="email" type="email" autoComplete="email" className="pr-10" aria-invalid={Boolean(emailError) || undefined} {...form.register("email")} />
          <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center" aria-hidden>
            {current?.status === "checking" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            {current?.status === "available" && !errors.email && <CircleCheck className="size-4 text-success" />}
          </span>
        </div>
        {taken && (
          <p className="mt-1 text-xs">
            <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">
              Entrar
            </Link>{" "}
            ·{" "}
            <Link href="/recuperar" className="font-medium text-primary hover:underline">
              Recuperar contraseña
            </Link>
          </p>
        )}
      </Field>
      <Field label="Contraseña" htmlFor="password" error={errors.password?.message}>
        <PasswordInput id="password" autoComplete="new-password" aria-invalid={Boolean(errors.password) || undefined} {...form.register("password")} />
        <PasswordChecklist value={password} />
      </Field>
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
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting} disabled={Boolean(taken)}>
        Crear cuenta
      </Button>
    </form>
  );
}

/** Pantalla tras registrarse: pide revisar el correo y permite reenviarlo. */
function ConfirmationSent({ email, next }: { email: string; next?: string }) {
  const [wait, setWait] = useState(RESEND_WAIT_S);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function resend() {
    setSending(true);
    const result = await resendConfirmation(email, next);
    setSending(false);
    if (!result.ok) return void toast.error(result.error);
    toast.success("Te enviamos el correo otra vez.");
    setWait(RESEND_WAIT_S);
  }

  return (
    <div className="text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
        <MailCheck className="size-6" />
      </div>
      <p className="mt-4 font-semibold">Revisa tu correo</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Enviamos un enlace de confirmación a <strong>{email}</strong>. Ábrelo para activar tu cuenta. Si no lo ves, revisa la carpeta de spam
        o promociones.
      </p>
      <Button variant="outline" className="mt-5" onClick={resend} loading={sending} disabled={wait > 0}>
        {wait > 0 ? `Reenviar correo en ${wait} s` : "Reenviar correo"}
      </Button>
    </div>
  );
}
