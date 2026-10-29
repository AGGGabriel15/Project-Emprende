import { PanelShell, type PanelNavItem } from "@/components/layout/panel-shell";
import { toShellUser } from "@/components/layout/site-shell";
import { getMyBusiness, requireProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROLE_HOME } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

const FULL_NAV: PanelNavItem[] = [
  { href: "/vendedor/panel", label: "Panel", icon: "dashboard" },
  { href: "/vendedor/pedidos", label: "Pedidos", icon: "orders" },
  { href: "/vendedor/productos", label: "Productos", icon: "products" },
  { href: "/vendedor/categorias", label: "Categorías", icon: "categories" },
  { href: "/vendedor/horarios", label: "Horarios", icon: "hours" },
  { href: "/vendedor/delivery", label: "Delivery", icon: "delivery" },
  { href: "/vendedor/finanzas", label: "Finanzas", icon: "finance" },
  { href: "/vendedor/reportes", label: "Reportes", icon: "reports" },
  { href: "/vendedor/configuracion", label: "Configuración", icon: "settings" },
];

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile(undefined, "/vendedor/panel");
  if (profile.role === "courier" || profile.role === "admin") redirect(ROLE_HOME[profile.role]);
  const business = await getMyBusiness();
  const active = business && ["approved", "suspended"].includes(business.status);

  let preparing = 0;
  if (active) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("status", "preparing");
    preparing = count ?? 0;
  }

  const nav = active
    ? [
        ...FULL_NAV.map((item) => (item.href === "/vendedor/pedidos" ? { ...item, badge: preparing } : item)),
        ...(business.tier === "informal"
          ? [{ href: "/vendedor/formalizar", label: "Pasar a formal", icon: "shield" as const }]
          : []),
      ]
    : [{ href: "/vendedor/solicitud", label: "Solicitud del negocio", icon: "application" as const }];

  return (
    <PanelShell
      title={business?.trade_name ?? "Registrar mi negocio"}
      subtitle={profile.email ?? undefined}
      nav={nav}
      user={toShellUser(profile, Boolean(business))}
      banner={
        business?.status === "suspended" ? (
          <div className="bg-destructive-soft px-6 py-3 text-sm text-destructive">
            Tu negocio está suspendido: no aparece en el catálogo. Contacta a la administración.
          </div>
        ) : null
      }
    >
      {children}
    </PanelShell>
  );
}
