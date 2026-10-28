import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordResetForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecoverPage() {
  return (
    <AuthCard
      title="Recupera tu contraseña"
      description="Te enviaremos un enlace para crear una nueva."
      footer={
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Volver a entrar
        </Link>
      }
    >
      <PasswordResetForm />
    </AuthCard>
  );
}
