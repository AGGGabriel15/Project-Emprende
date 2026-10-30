import { SiteShell } from "@/components/layout/site-shell";
import { redirectPanelUsers } from "@/lib/auth";

/** Carrito, checkout, pedidos y cuenta: solo clientes (los paneles tienen lo suyo). */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await redirectPanelUsers();
  return <SiteShell>{children}</SiteShell>;
}
