import { PanelShell, type PanelNavItem } from "@/components/layout/panel-shell";
import { toShellUser } from "@/components/layout/site-shell";
import { requireCourier } from "@/lib/auth";

const NAV: PanelNavItem[] = [
  { href: "/repartidor", label: "Entregas", icon: "delivery" },
  { href: "/repartidor/historial", label: "Historial", icon: "history" },
  { href: "/repartidor/perfil", label: "Mi perfil", icon: "user" },
];

export default async function CourierLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireCourier("/repartidor");
  return (
    <PanelShell title="Repartidor" subtitle={profile.full_name || profile.email || undefined} nav={NAV} user={toShellUser(profile, false)}>
      <div className="mx-auto max-w-2xl">{children}</div>
    </PanelShell>
  );
}
