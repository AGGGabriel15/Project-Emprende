import { KeyRound, LogOut, Store } from "lucide-react";
import Link from "next/link";
import { AddressBook } from "@/components/customer/address-book";
import { ProfileForm } from "@/components/customer/profile-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { AvatarUploader } from "@/components/upload/uploaders";
import { signOut } from "@/features/auth/actions";
import { getMyBusiness } from "@/lib/auth";
import { canShop } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import type { Address, Profile } from "@/types/domain";

const ROLE_LABEL = { customer: "Cliente", vendor: "Vendedor", admin: "Administrador" };

/** Perfil (foto, datos, direcciones y seguridad): /cuenta, /vendedor/perfil y /admin/perfil. */
export async function AccountSettings({ profile }: { profile: Profile }) {
  const shopper = canShop(profile.role);
  const supabase = await createClient();
  const [{ data: addresses }, business] = await Promise.all([
    shopper
      ? supabase.from("addresses").select("*").eq("user_id", profile.id).order("is_default", { ascending: false })
      : Promise.resolve({ data: [] }),
    getMyBusiness(),
  ]);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Mi perfil"
        description={profile.email}
        action={<Badge tone="brand">{ROLE_LABEL[profile.role]}</Badge>}
      />
      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Datos personales"
            description={shopper ? "Los usamos para coordinar tus entregas." : "Así te identifican en la plataforma."}
          />
          <CardBody className="space-y-6">
            <AvatarUploader name={profile.full_name || profile.email || "?"} url={profile.avatar_url} />
            <ProfileForm profile={profile} />
          </CardBody>
        </Card>

        {shopper && (
          <Card id="direcciones" className="scroll-mt-24">
            <CardHeader title="Direcciones de entrega" description="Elige una al pagar con delivery." />
            <CardBody>
              <AddressBook addresses={(addresses ?? []) as Address[]} />
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader title="Más opciones" />
          <CardBody className="flex flex-wrap gap-3">
            {profile.role !== "admin" &&
              (business ? (
                <Button asChild variant="outline">
                  <Link href="/vendedor/panel">
                    <Store /> Panel de {business.trade_name}
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link href="/vender">
                    <Store /> Registrar mi negocio
                  </Link>
                </Button>
              ))}
            <Button asChild variant="outline">
              <Link href="/actualizar-clave">
                <KeyRound /> Cambiar contraseña
              </Link>
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="ghost" className="text-destructive">
                <LogOut /> Cerrar sesión
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
