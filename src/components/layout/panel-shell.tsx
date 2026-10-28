"use client";

import {
  BarChart3,
  Bike,
  ClipboardList,
  Clock,
  FileText,
  Gauge,
  Layers,
  LayoutDashboard,
  Map,
  Menu,
  Package,
  Percent,
  ScrollText,
  Settings,
  ShieldCheck,
  Store,
  Tags,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { AccountMenu } from "./account-menu";
import { Logo } from "./logo";
import { NotificationsBell } from "./notifications-bell";
import type { ShellUser } from "./site-shell";

const ICONS = {
  gauge: Gauge,
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  products: Package,
  categories: Tags,
  hours: Clock,
  delivery: Bike,
  finance: Wallet,
  reports: BarChart3,
  settings: Settings,
  application: FileText,
  shield: ShieldCheck,
  store: Store,
  users: Users,
  percent: Percent,
  layers: Layers,
  map: Map,
  audit: ScrollText,
} as const;

export type PanelNavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: number;
};

export function PanelShell({
  title,
  subtitle,
  nav,
  banner,
  children,
  user,
}: {
  title: string;
  subtitle?: string;
  nav: PanelNavItem[];
  banner?: React.ReactNode;
  user: ShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = (
    <nav className="space-y-0.5" aria-label={title}>
      {nav.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4.5" />
            <span className="flex-1">{item.label}</span>
            {item.badge ? (
              <span className="rounded-full bg-accent px-1.5 text-xs font-bold text-accent-foreground">{item.badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-card lg:flex">
        <div className="border-b p-5">
          <Logo />
        </div>
        <div className="px-4 pt-5 pb-2">
          <p className="truncate text-sm font-semibold">{title}</p>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">{links}</div>
        <div className="border-t p-3">
          <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted">
            <Store className="size-4.5" /> Ir a la tienda
          </Link>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur lg:px-8">
          <button type="button" className="grid size-10 cursor-pointer place-items-center rounded-full hover:bg-muted lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú">
            <Menu className="size-5" />
          </button>
          <p className="min-w-0 flex-1 truncate font-semibold lg:invisible">{title}</p>
          <div className="flex items-center gap-1">
            <NotificationsBell userId={user.id} />
            <AccountMenu user={user} />
          </div>
        </header>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-card shadow-xl">
              <div className="flex items-center justify-between border-b p-4">
                <Logo />
                <button type="button" className="grid size-9 cursor-pointer place-items-center rounded-full hover:bg-muted" onClick={() => setOpen(false)} aria-label="Cerrar menú">
                  <X className="size-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">{links}</div>
              <Link href="/" className="border-t p-4 text-sm text-muted-foreground">Ir a la tienda</Link>
            </div>
          </div>
        )}
        {banner}
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
