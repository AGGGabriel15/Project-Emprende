import type { Role } from "@/types/domain";

/** Pantalla de inicio de cada rol tras iniciar sesión. */
export const ROLE_HOME: Record<Role, string> = {
  customer: "/",
  vendor: "/vendedor/panel",
  admin: "/admin/dashboard",
  courier: "/repartidor",
};

/** Dónde edita cada rol su perfil (los paneles tienen el suyo). */
export const ROLE_PROFILE: Record<Role, string> = {
  customer: "/cuenta",
  vendor: "/vendedor/perfil",
  admin: "/admin/perfil",
  courier: "/repartidor/perfil",
};

/** Panel de cada rol (prefijo de sus rutas). */
const ROLE_PANEL: Record<Exclude<Role, "customer">, string> = {
  vendor: "/vendedor",
  admin: "/admin",
  courier: "/repartidor",
};

/** Solo los clientes compran; vendedores, repartidores y administradores usan su panel. */
export function canShop(role: Role | null | undefined) {
  return !role || role === "customer";
}

/** Destino tras el login: cada rol con panel va a él salvo que pida una ruta de él. */
export function destinationFor(role: Role, next: string) {
  if (role === "customer") return next;
  return next.startsWith(ROLE_PANEL[role]) ? next : ROLE_HOME[role];
}

/** Teléfono y ubicación son obligatorios salvo para repartidores (los crea la administración). */
export function needsProfileCompletion(profile: { role: Role; phone: string | null; department_id: number | null }) {
  if (profile.role === "courier") return !profile.phone;
  return !profile.phone || !profile.department_id;
}

export const ROLE_LABEL: Record<Role, string> = {
  customer: "Cliente",
  vendor: "Vendedor",
  admin: "Admin",
  courier: "Repartidor",
};
