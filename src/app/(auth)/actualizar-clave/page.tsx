import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { NewPasswordForm } from "@/components/auth/password-forms";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default async function UpdatePasswordPage() {
  await requireProfile(undefined, "/actualizar-clave");
  return (
    <AuthCard title="Crea una nueva contraseña">
      <NewPasswordForm />
    </AuthCard>
  );
}
