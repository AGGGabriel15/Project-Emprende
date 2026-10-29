import { PanelShell, type PanelNavItem } from "@/components/layout/panel-shell";
import { toShellUser } from "@/components/layout/site-shell";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile(["admin"], "/admin/dashboard");
  const supabase = await createClient();
  const [{ count }, { count: upgrades }, { count: toReview }, { count: toShip }, { count: claims }] = await Promise.all([
    supabase.from("businesses").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("businesses").select("id", { count: "exact", head: true }).not("upgrade_requested_at", "is", null),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("review_status", "pending"),
    supabase.from("shipments").select("id", { count: "exact", head: true }).eq("status", "available"),
    supabase.from("claims").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  const nav: PanelNavItem[] = [
    { href: "/admin/dashboard", label: "Dashboard", icon: "gauge" },
    { href: "/admin/solicitudes", label: "Solicitudes", icon: "application", badge: (count ?? 0) + (upgrades ?? 0) },
    { href: "/admin/moderacion", label: "Moderación", icon: "products", badge: toReview ?? 0 },
    { href: "/admin/negocios", label: "Negocios", icon: "store" },
    { href: "/admin/usuarios", label: "Usuarios", icon: "users" },
    { href: "/admin/pedidos", label: "Pedidos", icon: "orders" },
    { href: "/admin/envios", label: "Envíos", icon: "delivery", badge: toShip ?? 0 },
    { href: "/admin/repartidores", label: "Repartidores", icon: "users" },
    { href: "/admin/reclamos", label: "Reclamos", icon: "shield", badge: claims ?? 0 },
    { href: "/admin/comisiones", label: "Comisiones", icon: "percent" },
    { href: "/admin/pagos-negocios", label: "Liquidaciones", icon: "finance" },
    { href: "/admin/categorias", label: "Categorías", icon: "layers" },
    { href: "/admin/zonas", label: "Zonas", icon: "map" },
    { href: "/admin/configuracion", label: "Configuración", icon: "settings" },
    { href: "/admin/auditoria", label: "Auditoría", icon: "audit" },
  ];

  return (
    <PanelShell title="Administración" subtitle={profile.email ?? undefined} nav={nav} user={toShellUser(profile, false)}>
      {children}
    </PanelShell>
  );
}
