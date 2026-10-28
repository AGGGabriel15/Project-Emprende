import type { Metadata } from "next";
import { PromptActionButton } from "@/components/admin/action-buttons";
import { GeneratePayoutsForm } from "@/components/admin/generate-payouts-form";
import { Badge } from "@/components/ui/badge";
import { Card, PageHeader } from "@/components/ui/card";
import { markPayoutPaid } from "@/features/admin/actions";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/utils";
import type { Payout } from "@/types/domain";

export const metadata: Metadata = { title: "Liquidaciones" };

export default async function PayoutsPage() {
  const supabase = await createClient();
  const [{ data: payouts }, { data: accounts }] = await Promise.all([
    supabase.from("payouts").select("*, business:businesses(trade_name)").order("created_at", { ascending: false }).limit(200),
    supabase.from("business_bank_accounts").select("*"),
  ]);
  const rows = (payouts ?? []) as (Payout & { business: { trade_name: string } | null })[];
  const pendingTotal = rows.filter((p) => p.status === "pending").reduce((s, p) => s + p.net_minor, 0);

  return (
    <>
      <PageHeader
        title="Liquidaciones a negocios"
        description={`Agrupa los pedidos completados por período. Pendiente de transferir: ${formatMoney(pendingTotal)}.`}
      />
      <GeneratePayoutsForm />
      <Card className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Negocio</th>
                <th className="px-5 py-3 font-medium">Período</th>
                <th className="px-5 py-3 text-right font-medium">Bruto</th>
                <th className="px-5 py-3 text-right font-medium">Comisión</th>
                <th className="px-5 py-3 text-right font-medium">Neto</th>
                <th className="px-5 py-3 font-medium">Cuenta</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((p) => {
                const account = accounts?.find((a) => a.business_id === p.business_id);
                return (
                  <tr key={p.id}>
                    <td className="px-5 py-3 font-medium">{p.business?.trade_name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{p.period_start} → {p.period_end} · {p.orders_count} ped.</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(p.gross_minor)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(p.commission_minor)}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatMoney(p.net_minor)}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {account ? `${account.bank_name} ${account.currency} · ${account.account_number}` : "Sin cuenta"}
                    </td>
                    <td className="px-5 py-3">
                      {p.status === "paid" ? (
                        <Badge tone="green">Pagado {p.paid_at ? formatDate(p.paid_at, false) : ""}</Badge>
                      ) : (
                        <PromptActionButton
                          size="sm"
                          title="Marcar como pagada"
                          description={`Transferencia de ${formatMoney(p.net_minor)} a ${p.business?.trade_name}.`}
                          label="Referencia de la transferencia"
                          multiline={false}
                          minLength={3}
                          confirmLabel="Confirmar pago"
                          success="Liquidación marcada como pagada."
                          action={async (reference: string) => {
                            "use server";
                            return markPayoutPaid(p.id, reference);
                          }}
                        >
                          Marcar pagada
                        </PromptActionButton>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">Aún no hay liquidaciones generadas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
