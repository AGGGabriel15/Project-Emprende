import { SiteShell } from "@/components/layout/site-shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
