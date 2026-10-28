import { ChevronRight, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Solicitudes" };

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const [{ data: pending }, { data: history }] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, trade_name, legal_name, submitted_at, category:platform_categories(name), owner:profiles!businesses_owner_id_fkey(full_name, email)")
      .eq("status", "pending")
      .order("submitted_at"),
    supabase
      .from("business_applications")
      .select("id, decision, reviewed_at, rejection_reason, business:businesses(id, trade_name)")
      .not("decision", "is", null)
      .order("reviewed_at", { ascending: false })
      .limit(15),
  ]);

  return (
    <>
      <PageHeader title="Solicitudes de negocios" description="Revisa los documentos y aprueba o rechaza con motivo. Ambas decisiones envían correo." />
      {(pending ?? []).length === 0 ? (
        <EmptyState icon={<Inbox />} title="No hay solicitudes pendientes" />
      ) : (
        <Card>
          <ul className="divide-y">
            {(pending ?? []).map((b) => {
              const owner = b.owner as unknown as { full_name: string; email: string } | null;
              const category = b.category as unknown as { name: string } | null;
              return (
                <li key={b.id}>
                  <Link href={`/admin/solicitudes/${b.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{b.trade_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {category?.name} · {owner?.full_name} ({owner?.email})
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">Enviada {b.submitted_at ? formatDate(b.submitted_at) : ""}</span>
                    <ChevronRight className="size-5 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {(history ?? []).length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Revisadas recientemente</h2>
          <Card>
            <ul className="divide-y text-sm">
              {(history ?? []).map((a) => {
                const business = a.business as unknown as { id: string; trade_name: string } | null;
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <Link href={`/admin/solicitudes/${business?.id}`} className="font-medium hover:text-primary">{business?.trade_name}</Link>
                    <Badge tone={a.decision === "approved" ? "green" : "red"}>{a.decision === "approved" ? "Aprobada" : "Rechazada"}</Badge>
                    {a.rejection_reason && <span className="text-muted-foreground">{a.rejection_reason}</span>}
                    <span className="ml-auto text-xs text-muted-foreground">{a.reviewed_at ? formatDate(a.reviewed_at) : ""}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}
    </>
  );
}
