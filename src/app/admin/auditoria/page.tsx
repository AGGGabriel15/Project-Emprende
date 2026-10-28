import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate } from "@/lib/utils";
import type { AuditLog } from "@/types/domain";

export const metadata: Metadata = { title: "Auditoría" };

const ENTITIES = [
  ["all", "Todo"],
  ["business", "Negocios"],
  ["profile", "Usuarios"],
  ["order", "Pedidos"],
  ["setting", "Configuración"],
  ["commission_rule", "Comisiones"],
  ["payout", "Liquidaciones"],
] as const;

type SearchParams = Promise<{ tipo?: string }>;

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const { tipo = "all" } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select("*, actor:profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (tipo !== "all") query = query.eq("entity_type", tipo);
  const { data } = await query;
  const logs = (data ?? []) as (AuditLog & { actor: { full_name: string; email: string } | null })[];

  return (
    <>
      <PageHeader title="Auditoría" description="Toda acción de administración queda registrada." />
      <nav className="scrollbar-none mb-4 flex gap-1 overflow-x-auto">
        {ENTITIES.map(([value, label]) => (
          <Link
            key={value}
            href={`/admin/auditoria?tipo=${value}`}
            className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap", tipo === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Card>
        <ul className="divide-y text-sm">
          {logs.map((log) => (
            <li key={log.id} className="grid gap-1 px-5 py-3 sm:grid-cols-[180px_200px_1fr]">
              <span className="text-muted-foreground">{formatDate(log.created_at)}</span>
              <span className="truncate">{log.actor?.full_name || log.actor?.email || "Sistema"}</span>
              <span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{log.action}</code>
                {Object.keys(log.details ?? {}).length > 0 && (
                  <span className="ml-2 text-xs break-all text-muted-foreground">{JSON.stringify(log.details)}</span>
                )}
              </span>
            </li>
          ))}
          {logs.length === 0 && <li className="px-5 py-8 text-center text-muted-foreground">Sin registros.</li>}
        </ul>
      </Card>
    </>
  );
}
