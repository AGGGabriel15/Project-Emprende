"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/form-controls";
import { useHydrated } from "@/lib/use-hydrated";
import { loginSchema } from "@/validations/auth";

type LoginInput = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { status: sessionStatus } = useSession();
  const [error, setError] = useState("");
  const hydrated = useHydrated();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting: formSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  const isSubmitting =
    !hydrated || sessionStatus === "loading" || formSubmitting;

  const submit = handleSubmit(async (input) => {
    setError("");
    let result = await signIn("credentials", { ...input, redirect: false });
    // A session check can rotate NextAuth's CSRF cookie while this page loads.
    // One transparent retry uses the current token and avoids a false login error.
    if (result?.url?.includes("csrf=true")) {
      result = await signIn("credentials", { ...input, redirect: false });
    }
    if (result?.url?.includes("csrf=true")) {
      setError("No se pudo validar la sesion. Intenta nuevamente.");
      return;
    }
    if (result?.error) {
      setError("Correo o contraseña incorrectos, o la cuenta está inactiva.");
      return;
    }
    const callback = params.get("callbackUrl");
    router.push(callback?.startsWith("/") ? callback : "/");
    router.refresh();
  });

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...register("email")}
        />
        <FieldError>{errors.email?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        <FieldError>{errors.password?.message}</FieldError>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Ingresando..." : "Ingresar"}
      </Button>
      <p className="text-center text-sm text-[#65736b]">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/registro" className="font-bold text-[#236b4e]">
          Regístrate
        </Link>
      </p>
    </form>
  );
}
