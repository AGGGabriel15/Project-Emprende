import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton, PromptActionButton } from "@/components/admin/action-buttons";
import { Rating } from "@/components/catalog/rating";
import { Badge } from "@/components/ui/badge";
import { Card, PageHeader } from "@/components/ui/card";
import { setBusinessSuspended } from "@/features/admin/actions";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate } from "@/lib/utils";
import type { BusinessStatus } from "@/types/domain";

export const metadata: Metadata = { title: "Negocios" };

const FILTERS: { value: BusinessStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "approved", label: "Aprobados" },
  { value: "pending", label: "Pendientes" },
  { value: "suspended", label: "Suspendidos" },
  { value: "rejected", label: "Rechazados" },
  { value: "draft", label: "Borradores" },
];

const TONE = { draft: "gray", pending: "amber", approved: "green", rejected: "red", suspended: "red" } as const;

type SearchParams = Promise<{ estado?: string }>;

export default async function AdminBusinessesPage({ searchParams }: { searchParams: SearchParams }) {
  const { estado = "all" } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("businesses")
    .select("id, trade_name, slug, status, rating_avg, rating_count, approved_at, created_at, category:platform_categories(name), owner:profiles!businesses_owner_id_fkey(email)")
    .order("created_at", { ascending: false });
  if (estado !== "all") query = query.eq("status", estado);
  const { data } = await query;

  return (
    <>
      <PageHeader title="Negocios" description="Un negocio suspendido se oculta del catálogo pero conserva sus datos." />
      <nav className="scrollbar-none mb-4 flex gap-1 overflow-x-auto">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/negocios?estado=${f.value}`}
            className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap", estado === f.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Negocio</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Calificación</th>
                <th className="px-5 py-3 font-medium">Alta</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {(data ?? []).map((b) => {
                const owner = b.owner as unknown as { email: string } | null;
                const category = b.category as unknown as { name: string } | null;
                const status = b.status as BusinessStatus;
                return (
                  <tr key={b.id}>
                    <td className="px-5 py-3">
                      <Link href={`/admin/solicitudes/${b.id}`} className="font-medium hover:text-primary">{b.trade_name}</Link>
                      <p className="text-xs text-muted-foreground">{category?.name ?? "—"} · {owner?.email}</p>
                    </td>
                    <td className="px-5 py-3"><Badge tone={TONE[status]}>{status}</Badge></td>
                    <td className="px-5 py-3"><Rating value={b.rating_avg} count={b.rating_count} /></td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(b.approved_at ?? b.created_at, false)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        {status === "approved" && (
                          <>
                            <Link href={`/negocios/${b.slug}`} target="_blank" className="grid size-9 place-items-center rounded-full hover:bg-muted" aria-label="Ver página">
                              <ExternalLink className="size-4" />
                            </Link>
                            <PromptActionButton
                              size="sm"
                              variant="danger"
                              title={`Suspender ${b.trade_name}`}
                              label="Motivo (se notifica al negocio)"
                              confirmLabel="Suspender"
                              success="Negocio suspendido."
                              action={async (reason: string) => {
                                "use server";
                                return setBusinessSuspended(b.id, true, reason);
                              }}
                            >
                              Suspender
                            </PromptActionButton>
                          </>
                        )}
                        {status === "suspended" && (
                          <ActionButton size="sm" variant="outline" success="Negocio reactivado." action={setBusinessSuspended.bind(null, b.id, false, "Reactivado por la administración")}>
                            Reactivar
                          </ActionButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
