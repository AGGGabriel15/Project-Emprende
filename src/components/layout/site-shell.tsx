import { CartSync } from "@/components/customer/cart-sync";
import { ViewerProvider } from "@/components/viewer";
import { getMyBusiness, getSession } from "@/lib/auth";
import { canShop } from "@/lib/roles";
import type { Profile, Role } from "@/types/domain";
import { Footer } from "./footer";
import { MobileNav } from "./mobile-nav";
import { SiteHeader } from "./site-header";

/** Navbar + contenido + footer + barra inferior móvil para cliente y visitantes. */
export async function SiteShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const business = session ? await getMyBusiness() : null;
  const user = session ? toShellUser(session.profile, Boolean(business)) : null;

  return (
    <ViewerProvider role={user?.role ?? null}>
      <CartSync userId={user && canShop(user.role) ? user.id : null} />
      <SiteHeader user={user} />
      <main className="min-h-[calc(100dvh-4rem)] pb-24 md:pb-0">{children}</main>
      <Footer />
      <MobileNav user={user} />
    </ViewerProvider>
  );
}

export type ShellUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  hasBusiness: boolean;
  location: { departmentId: number; municipalityId: number } | null;
};

export function toShellUser(profile: Profile, hasBusiness: boolean): ShellUser {
  return {
    id: profile.id,
    name: profile.full_name || profile.email || "Mi cuenta",
    email: profile.email ?? "",
    avatarUrl: profile.avatar_url,
    role: profile.role,
    hasBusiness,
    location:
      profile.department_id && profile.municipality_id
        ? { departmentId: profile.department_id, municipalityId: profile.municipality_id }
        : null,
  };
}
