import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { ActionButton } from "@/components/admin/action-buttons";
import { CommissionForms } from "@/components/admin/commission-forms";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { deleteCommissionRule } from "@/features/admin/actions";
import { listCategories } from "@/features/catalog/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPercent } from "@/lib/utils";
import type { CommissionRule } from "@/types/domain";

export const metadata: Metadata = { title: "Comisiones" };

export default async function CommissionsPage() {
  const supabase = await createClient();
  const [{ data: setting }, { data: rules }, { data: businesses }, categories] = await Promise.all([
    supabase.from("platform_settings").select("value").eq("key", "commission_rate").maybeSingle(),
    supabase.from("commission_rules").select("*").order("created_at", { ascending: false }),
    supabase.from("businesses").select("id, trade_name").eq("status", "approved").order("trade_name"),
    listCategories(),
  ]);
  const rate = Number(setting?.value ?? 0.08);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Comisiones"
        description="Prioridad: regla del negocio > regla de la categoría > tasa global. Al pagar, la tasa se congela en el pedido."
      />
      <CommissionForms
        globalRate={rate}
        businesses={(businesses ?? []) as { id: string; trade_name: string }[]}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
      <Card className="mt-6">
        <CardHeader title="Reglas especiales" />
        <ul className="divide-y">
          {((rules ?? []) as CommissionRule[]).map((rule) => {
            const target = rule.business_id
              ? businesses?.find((b) => b.id === rule.business_id)?.trade_name ?? "Negocio"
              : `Categoría: ${categories.find((c) => c.id === rule.category_id)?.name}`;
            return (
              <li key={rule.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="font-semibold tabular-nums">{formatPercent(Number(rule.rate))}</span>
                <span className="flex-1">{target}</span>
                <span className="text-muted-foreground">
                  {formatDate(`${rule.valid_from}T12:00:00`, false)} → {rule.valid_to ? formatDate(`${rule.valid_to}T12:00:00`, false) : "sin fin"}
                </span>
                {rule.note && <span className="w-full text-xs text-muted-foreground">{rule.note}</span>}
                <ActionButton
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  aria-label="Eliminar regla"
                  confirm="¿Eliminar esta regla?"
                  success="Regla eliminada."
                  action={deleteCommissionRule.bind(null, rule.id)}
                >
                  <Trash2 />
                </ActionButton>
              </li>
            );
          })}
          {(rules ?? []).length === 0 && <li className="px-5 py-6 text-sm text-muted-foreground">Sin reglas: todos pagan la tasa global.</li>}
        </ul>
      </Card>
    </div>
  );
}
