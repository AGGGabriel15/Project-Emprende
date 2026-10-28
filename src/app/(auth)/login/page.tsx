import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, Divider } from "@/components/auth/auth-card";
import { GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  callback: "No pudimos completar el inicio de sesión. Inténtalo de nuevo.",
  inactive: "Tu cuenta está desactivada. Contacta a soporte.",
};

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next, error } = await searchParams;
  return (
    <AuthCard
      title="Bienvenido de vuelta"
      description="Entra para pagar tus pedidos y darles seguimiento."
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link
            href={`/registro${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-semibold text-primary hover:underline"
          >
            Regístrate gratis
          </Link>
        </>
      }
    >
      {error && ERRORS[error] && (
        <p role="alert" className="mb-4 rounded-xl bg-destructive-soft p-3 text-sm text-destructive">
          {ERRORS[error]}
        </p>
      )}
      <GoogleButton next={next} />
      <Divider>o con tu correo</Divider>
      <LoginForm next={next} />
    </AuthCard>
  );
}
