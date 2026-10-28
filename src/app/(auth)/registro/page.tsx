import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, Divider } from "@/components/auth/auth-card";
import { GoogleButton } from "@/components/auth/google-button";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

type SearchParams = Promise<{ next?: string }>;

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;
  return (
    <AuthCard
      title="Crea tu cuenta"
      description="Gratis. Necesaria para pagar y seguir tus pedidos; también para registrar tu negocio."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link
            href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-semibold text-primary hover:underline"
          >
            Entrar
          </Link>
        </>
      }
    >
      <GoogleButton next={next} />
      <Divider>o con tu correo</Divider>
      <RegisterForm next={next} />
    </AuthCard>
  );
}
