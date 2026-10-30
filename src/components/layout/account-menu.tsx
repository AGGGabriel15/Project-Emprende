"use client";

import {
  Bike,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  ShieldCheck,
  ShoppingBag,
  Store,
  User,
} from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/features/auth/actions";
import { canShop, ROLE_HOME, ROLE_PROFILE } from "@/lib/roles";
import { forgetBrowserSession } from "@/lib/supabase/client";
import { cn, initials } from "@/lib/utils";
import type { ShellUser } from "./site-shell";

export function Avatar({ name, url, className = "size-9" }: { name: string; url?: string | null; className?: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={cn("shrink-0 rounded-full object-cover", className)} referrerPolicy="no-referrer" />
  ) : (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary", className)}>
      {initials(name) || "?"}
    </span>
  );
}

export function AccountMenu({ user }: { user: ShellUser }) {
  const shopper = canShop(user.role);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="ml-1 cursor-pointer rounded-full ring-2 ring-transparent transition hover:ring-primary/30"
        aria-label="Menú de cuenta"
      >
        <Avatar name={user.name} url={user.avatarUrl} />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel className="flex items-center gap-3">
          <Avatar name={user.name} url={user.avatarUrl} className="size-10" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{user.name}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.role === "admin" && (
          <DropdownMenuItem asChild>
            <Link href={ROLE_HOME.admin}>
              <ShieldCheck /> Panel de administración
            </Link>
          </DropdownMenuItem>
        )}
        {user.role === "courier" && (
          <DropdownMenuItem asChild>
            <Link href={ROLE_HOME.courier}>
              <Bike /> Mis entregas
            </Link>
          </DropdownMenuItem>
        )}
        {(user.role === "vendor" || user.hasBusiness) && (
          <DropdownMenuItem asChild>
            <Link href="/vendedor/panel">
              <LayoutDashboard /> Panel de mi negocio
            </Link>
          </DropdownMenuItem>
        )}
        {shopper && (
          <DropdownMenuItem asChild>
            <Link href="/pedidos">
              <Package /> Mis pedidos
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={ROLE_PROFILE[user.role]}>
            <User /> Mi perfil
          </Link>
        </DropdownMenuItem>
        {shopper && (
          <DropdownMenuItem asChild>
            <Link href="/cuenta#direcciones">
              <MapPin /> Direcciones
            </Link>
          </DropdownMenuItem>
        )}
        {shopper && !user.hasBusiness && (
          <DropdownMenuItem asChild>
            <Link href="/vender">
              <Store /> Vender en Catarina Market
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/">
            <ShoppingBag /> Ir a la tienda
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            forgetBrowserSession();
            void signOut();
          }}
          className="text-destructive"
        >
          <LogOut /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
