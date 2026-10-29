import { AlertTriangle, RefreshCw, ShieldCheck, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import { ActionButton, PromptActionButton } from "@/components/admin/action-buttons";
import { ResolveClaimForm } from "@/components/admin/resolve-claim-form";
import { EvidenceGallery } from "@/components/orders/evidence-gallery";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { processRefundsNow, voidStrike } from "@/features/admin/actions";
import { signEvidence } from "@/features/logistics/evidence";
import { CLAIM_REASONS } from "@/features/orders/status";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/utils";
import type { Claim } from "@/types/domain";

export const metadata: Metadata = { title: "Reclamos" };

type ClaimRow = Claim & {
  order: {
    id: string;
    order_number: string;
    total_minor: number;
    subtotal_minor: number;
    delivery_method: string | null;
    delivered_at: string | null;
    ready_photo_path: string | null;
    ready_at: string | null;
    business: { trade_name: string } | null;
    shipment: { courier_name: string; pickup_photo_path: string | null; picked_up_at: string | null; delivery_photo_path: string | null; delivered_at: string | null } | null;
    refunds: { amount_minor: number; status: string }[];
  } | null;
};

export default async function ClaimsPage() {
  const supabase = await createClient();
  const [{ data: open }, { data: refunds }, { data: strikes }] = await Promise.all([
    supabase
      .from("claims")
      .select(
        "*, order:orders(id, order_number, total_minor, subtotal_minor, delivery_method, delivered_at, ready_photo_path, ready_at, business:businesses(trade_name), shipment:shipments(courier_name, pickup_photo_path, picked_up_at, delivery_photo_path, delivered_at), refunds(amount_minor, status))",
      )
      .eq("status", "open")
      .order("created_at"),
    supabase
      .from("refunds")
      .select("id, amount_minor, reason, status, error, created_at, order:orders(order_number)")
      .in("status", ["pending", "failed"])
      .order("created_at"),
    supabase
      .from("strikes")
      .select("id, reason, created_at, voided_at, voided_reason, business:businesses(trade_name)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const claims = (open ?? []) as unknown as ClaimRow[];
  const evidence = await signEvidence(
    claims.flatMap((c) => [c.order?.ready_photo_path, c.order?.shipment?.pickup_photo_path, c.order?.shipment?.delivery_photo_path, ...c.photo_paths]),
  );

  return (
    <>
      <PageHeader
        title="Reclamos y reembolsos"
        description="Decide con la evidencia de cada paso: foto del negocio al empacar, foto de recolección, PIN y foto de entrega."
      />

      {claims.length === 0 ? (
        <EmptyState icon={<ShieldCheck />} title="No hay reclamos abiertos" />
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => {
            const order = claim.order!;
            const refunded = order.refunds.filter((r) => r.status !== "failed").reduce((sum, r) => sum + r.amount_minor, 0);
            return (
              <Card key={claim.id} data-claim={order.order_number}>
                <CardHeader
                  title={`${order.order_number} · ${CLAIM_REASONS[claim.reason]}`}
                  description={`${order.business?.trade_name} · entregado ${order.delivered_at ? formatDate(order.delivered_at) : "—"}${order.delivery_method === "pin" ? " con PIN" : ""} · total ${formatMoney(order.total_minor)}`}
                />
                <CardBody className="space-y-4 text-sm">
                  {claim.flags.map((flag) => (
                    <p key={flag} className="flex items-center gap-2 rounded-xl bg-warning-soft p-3">
                      <AlertTriangle className="size-4 shrink-0 text-warning" /> {flag}
                    </p>
                  ))}
                  <p className="whitespace-pre-line">“{claim.description}”</p>
                  <EvidenceGallery
                    items={[
                      { label: "Negocio al empacar", url: evidence[order.ready_photo_path ?? ""], at: order.ready_at },
                      { label: `Recolección (${order.shipment?.courier_name ?? ""})`, url: evidence[order.shipment?.pickup_photo_path ?? ""], at: order.shipment?.picked_up_at },
                      { label: "Entrega", url: evidence[order.shipment?.delivery_photo_path ?? ""], at: order.shipment?.delivered_at },
                      ...claim.photo_paths.map((path, i) => ({ label: `Foto del cliente ${i + 1}`, url: evidence[path] })),
                    ]}
                  />
                  <ResolveClaimForm claimId={claim.id} refundable={order.total_minor - refunded} subtotal={order.subtotal_minor} />
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader
          title={`Reembolsos en cola (${(refunds ?? []).length})`}
          description="Se procesan solos al cancelar o resolver; si la pasarela falla quedan aquí con el error."
          action={
            (refunds ?? []).length > 0 ? (
              <ActionButton size="sm" variant="outline" success="Reembolsos procesados." action={processRefundsNow}>
                <RefreshCw /> Procesar ahora
              </ActionButton>
            ) : null
          }
        />
        <ul className="divide-y text-sm">
          {(refunds ?? []).map((refund) => {
            const order = refund.order as unknown as { order_number: string } | null;
            return (
              <li key={refund.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="font-medium">{order?.order_number}</span>
                <Badge tone={refund.status === "failed" ? "red" : "amber"}>{refund.status === "failed" ? "Con error" : "Pendiente"}</Badge>
                <span className="text-muted-foreground">{refund.reason}</span>
                {refund.error && <span className="text-xs text-destructive">{refund.error}</span>}
                <span className="ml-auto tabular-nums">{formatMoney(refund.amount_minor)}</span>
              </li>
            );
          })}
          {(refunds ?? []).length === 0 && <li className="px-5 py-6 text-center text-muted-foreground">Sin reembolsos pendientes.</li>}
        </ul>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Faltas recientes" description="3 faltas vigentes en 90 días suspenden la tienda automáticamente." />
        <ul className="divide-y text-sm">
          {(strikes ?? []).map((strike) => {
            const business = strike.business as unknown as { trade_name: string } | null;
            return (
              <li key={strike.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="font-medium">{business?.trade_name}</span>
                <span className={strike.voided_at ? "text-muted-foreground line-through" : ""}>{strike.reason}</span>
                {strike.voided_reason && <span className="text-xs text-muted-foreground">Anulada: {strike.voided_reason}</span>}
                <span className="ml-auto text-xs text-muted-foreground">{formatDate(strike.created_at)}</span>
                {!strike.voided_at && (
                  <PromptActionButton
                    size="sm"
                    variant="ghost"
                    title="Anular falta"
                    label="Motivo"
                    confirmLabel="Anular"
                    success="Falta anulada."
                    action={async (reason: string) => {
                      "use server";
                      return voidStrike(strike.id, reason);
                    }}
                  >
                    <Undo2 /> Anular
                  </PromptActionButton>
                )}
              </li>
            );
          })}
          {(strikes ?? []).length === 0 && <li className="px-5 py-6 text-center text-muted-foreground">Sin faltas.</li>}
        </ul>
      </Card>
    </>
  );
}
