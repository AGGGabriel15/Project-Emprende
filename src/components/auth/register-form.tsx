"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
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
import { registerSchema } from "@/validations/auth";

type RegisterInput = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "cliente", name: "", email: "", password: "" },
  });
  const role = useWatch({ control: form.control, name: "role" });
  const submit = form.handleSubmit(async (input) => {
    setServerError("");
    const response = await fetch("/api/registro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await response.json();
    if (!response.ok) {
      setServerError(body.error?.message ?? "No pudimos crear la cuenta.");
      return;
    }
    await signIn("credentials", {
      email: input.email,
      password: input.password,
      redirect: false,
    });
    router.push(input.role === "emprendedor" ? "/dashboard" : "/");
    router.refresh();
  });
  const error = form.formState.errors;
  return (
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
      <div>
        <Label htmlFor="name">Nombre completo</Label>
        <Input id="name" {...form.register("name")} />
        <FieldError>{error.name?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="email">Correo</Label>
        <Input id="email" type="email" {...form.register("email")} />
        <FieldError>{error.email?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" type="password" {...form.register("password")} />
        <FieldError>{error.password?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="role">Tipo de cuenta</Label>
        <Select id="role" {...form.register("role")}>
          <option value="cliente">Quiero comprar</option>
          <option value="emprendedor">Quiero vender</option>
        </Select>
      </div>
      {role === "emprendedor" && (
        <>
          <div className="sm:col-span-2">
            <Label htmlFor="businessName">Nombre del negocio</Label>
            <Input id="businessName" {...form.register("businessName")} />
            <FieldError>{error.businessName?.message}</FieldError>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description">Cuéntanos sobre tu negocio</Label>
            <Textarea id="description" {...form.register("description")} />
            <FieldError>{error.description?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" {...form.register("phone")} />
            <FieldError>{error.phone?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="address">Dirección para retiros</Label>
            <Input id="address" {...form.register("address")} />
            <FieldError>{error.address?.message}</FieldError>
          </div>
        </>
      )}
      {serverError && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2"
        >
          {serverError}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button
          className="w-full"
          type="submit"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting
            ? "Creando cuenta..."
            : "Crear mi cuenta"}
        </Button>
      </div>
    </form>
  );
}
