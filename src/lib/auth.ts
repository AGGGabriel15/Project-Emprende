import { redirect } from "next/navigation";
import { cache } from "react";
import { ROLE_HOME } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import type { Business, Profile, Role } from "@/types/domain";

/**
 * Vendedores, repartidores y administradores no navegan la tienda: van a su
 * panel. Se llama en las páginas de compra (inicio, explorar, negocios, carrito…).
 */
export async function redirectPanelUsers() {
  const session = await getSession();
  const role = session?.profile.role;
  if (role && role !== "customer") redirect(ROLE_HOME[role]);
}

/**
 * Página de un negocio o de un producto: el cliente ve todas; el administrador
 * también; el vendedor solo la suya (para verla como la ven sus clientes); el
 * repartidor ninguna.
 */
export async function requireBusinessViewer(ownerId: string) {
  const session = await getSession();
  const role = session?.profile.role;
  if (!role || role === "customer" || role === "admin") return;
  if (role === "vendor" && session.user.id === ownerId) return;
  redirect(ROLE_HOME[role]);
}

/** Usuario + perfil de la petición actual (memoizado por render). */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  if (!profile) return null;
  return { user, profile };
});

export async function requireProfile(roles?: Role[], next = "/") {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!session.profile.is_active) redirect("/login?error=inactive");
  if (roles && !roles.includes(session.profile.role)) redirect(ROLE_HOME[session.profile.role]);
  return session;
}

/** Páginas de compra (checkout, pedidos): vendedores y admins van a su panel. */
export async function requireCustomer(next = "/") {
  return requireProfile(["customer"], next);
}

export async function requireCourier(next = "/repartidor") {
  return requireProfile(["courier"], next);
}

/** Perfil completo = teléfono y ubicación (requisito tras login con Google). */
export function isProfileComplete(profile: Profile) {
  return Boolean(profile.phone && profile.department_id && profile.municipality_id);
}

export const getMyBusiness = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", session.user.id)
    .maybeSingle<Business>();
  return data;
});

/** Para páginas del panel: exige un negocio aprobado (o suspendido, solo lectura). */
export async function requireApprovedBusiness(next: string) {
  const session = await requireProfile(undefined, next);
  const business = await getMyBusiness();
  if (!business || !["approved", "suspended"].includes(business.status)) {
    redirect("/vendedor/solicitud");
  }
  return { ...session, business };
}
