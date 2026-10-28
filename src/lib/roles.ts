import type { Role } from "@/types/domain";

/** Pantalla de inicio de cada rol tras iniciar sesión. */
export const ROLE_HOME: Record<Role, string> = {
  customer: "/",
  vendor: "/vendedor/panel",
  admin: "/admin/dashboard",
};

/** Dónde edita cada rol su perfil (los paneles tienen el suyo). */
export const ROLE_PROFILE: Record<Role, string> = {
  customer: "/cuenta",
  vendor: "/vendedor/perfil",
  admin: "/admin/perfil",
};

/** Solo los clientes compran; vendedores y administradores usan su panel. */
export function canShop(role: Role | null | undefined) {
  return !role || role === "customer";
}

/** Destino tras el login: vendedores y admins van a su panel salvo que pidan una ruta de él. */
export function destinationFor(role: Role, next: string) {
  if (role === "customer") return next;
  const panel = role === "admin" ? "/admin" : "/vendedor";
  return next.startsWith(panel) ? next : ROLE_HOME[role];
}
