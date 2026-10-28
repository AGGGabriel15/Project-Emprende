import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ProfileForm } from "@/components/customer/profile-form";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Completa tu perfil" };

type SearchParams = Promise<{ next?: string }>;

export default async function CompleteProfilePage({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;
  const { profile } = await requireProfile(undefined, "/completar-perfil");
  const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  return (
    <AuthCard
      title="Un último paso"
      description="Tu teléfono y ubicación ayudan al negocio a coordinar la entrega."
    >
      <ProfileForm profile={profile} redirectTo={destination} submitLabel="Guardar y continuar" />
    </AuthCard>
  );
}
