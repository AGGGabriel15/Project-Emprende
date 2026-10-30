"use client";

import { LayoutDashboard, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LocationPicker } from "@/components/customer/location-picker";
import { Button } from "@/components/ui/button";
import { canShop, ROLE_HOME } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { AccountMenu } from "./account-menu";
import { CartButton } from "./cart-button";
import { Logo } from "./logo";
import { NotificationsBell } from "./notifications-bell";
import type { ShellUser } from "./site-shell";

const NAV = [
  { href: "/", label: "Inicio" },
  { href: "/buscar", label: "Explorar" },
  { href: "/negocios", label: "Negocios" },
  { href: "/pedidos", label: "Pedidos" },
];

export function SiteHeader({ user }: { user: ShellUser | null }) {
  const pathname = usePathname();
  const shopper = canShop(user?.role);
  // Los paneles (vendedor, repartidor, admin) no navegan la tienda: solo su botón de panel.
  const nav = shopper ? NAV : [];
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-3 md:gap-5">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
          {nav.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-3 py-2 text-sm font-medium transition hover:bg-muted",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {/* <Suspense fallback={<div className="hidden flex-1 md:block" />}>
          <HeaderSearch />
        </Suspense> */}
        <div className="ml-auto hidden md:block">
          {shopper && <LocationPicker isLoggedIn={Boolean(user)} profileLocation={user?.location ?? null} />}
        </div>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          {shopper ? (
            <CartButton />
          ) : (
            <Button asChild size="sm" variant="outline" className="mr-1">
              <Link href={ROLE_HOME[user!.role]}>
                <LayoutDashboard /> <span className="hidden sm:inline">{user!.role === "admin" ? "Administración" : "Mi panel"}</span>
              </Link>
            </Button>
          )}
          {user ? (
            <>
              <NotificationsBell userId={user.id} />
              <AccountMenu user={user} />
            </>
          ) : (
            <Button asChild size="sm" className="ml-1">
              <Link href={`/login?next=${encodeURIComponent(pathname)}`}>Entrar</Link>
            </Button>
          )}
        </div>
      </div>
      {shopper && (
        <div className="container-page flex h-11 items-center border-t md:hidden">
          <LocationPicker compact isLoggedIn={Boolean(user)} profileLocation={user?.location ?? null} />
        </div>
      )}
    </header>
  );
}

function HeaderSearch() {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <form
      role="search"
      className="relative hidden max-w-sm flex-1 md:block"
      onSubmit={(event) => {
        event.preventDefault();
        const q = new FormData(event.currentTarget).get("q")?.toString().trim();
        router.push(q ? `/buscar?q=${encodeURIComponent(q)}` : "/buscar");
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        name="q"
        defaultValue={params.get("q") ?? ""}
        placeholder="Buscar jarrones, helechos, hamacas…"
        aria-label="Buscar productos"
        className="h-10 w-full rounded-full border bg-muted/60 pr-4 pl-10 text-sm transition placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:outline-none"
      />
    </form>
  );
}
