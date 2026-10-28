"use client";

import { Home, LayoutDashboard, Package, Search, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cartCount, useCart } from "@/features/cart/store";
import { canShop, ROLE_HOME, ROLE_PROFILE } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { useCartHydrated } from "./cart-button";
import type { ShellUser } from "./site-shell";

/** Barra inferior en móvil: Inicio, Buscar, Carrito, Pedidos, Cuenta (o Panel para vendedores y admins). */
export function MobileNav({ user }: { user: ShellUser | null }) {
  const pathname = usePathname();
  const count = useCart((state) => cartCount(state.items));
  const hydrated = useCartHydrated();
  const items: { href: string; label: string; icon: typeof Home; badge?: number }[] = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/buscar", label: "Buscar", icon: Search },
    ...(canShop(user?.role)
      ? [
          { href: "/carrito", label: "Carrito", icon: ShoppingBag, badge: hydrated ? count : 0 },
          { href: "/pedidos", label: "Pedidos", icon: Package },
        ]
      : [{ href: ROLE_HOME[user!.role], label: "Panel", icon: LayoutDashboard }]),
    { href: user ? ROLE_PROFILE[user.role] : "/login", label: "Cuenta", icon: User },
  ];
  return (
    <nav
      aria-label="Navegación móvil"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className={cn("grid", items.length === 5 ? "grid-cols-5" : "grid-cols-4")}>
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={label}>
              <Link
                href={href}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon className={cn("size-5", active && "stroke-[2.4]")} />
                  {badge ? (
                    <span className="absolute -top-1.5 -right-2.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground ring-2 ring-background">
                      {badge}
                    </span>
                  ) : null}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
