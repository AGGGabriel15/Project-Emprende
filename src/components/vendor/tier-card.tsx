import { ArrowRight, BadgeCheck, Home } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import { TIER_INFO } from "@/lib/validations/business";
import type { BusinessTier } from "@/types/domain";

type Limits = {
  tier: BusinessTier;
  max_active: number;
  monthly_cap_minor: number | null;
  active_orders: number;
  month_sales_minor: number;
  completed_orders: number;
};

/** Nivel del vendedor y sus límites actuales (transparencia). */
export async function TierCard() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_business_limits").maybeSingle<Limits>();
  if (!data) return null;
  const informal = data.tier === "informal";
  const Icon = informal ? Home : BadgeCheck;
  const cap = data.monthly_cap_minor === null ? null : Number(data.monthly_cap_minor);
  const sales = Number(data.month_sales_minor);
  const usage = cap ? Math.min(100, Math.round((sales / cap) * 100)) : null;

  return (
    <Card className="mb-6 flex flex-wrap items-center gap-4 p-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{TIER_INFO[data.tier].label}</p>
        <p className="text-sm text-muted-foreground">
          {data.active_orders} de {data.max_active} pedidos en curso
          {cap !== null && ` · ${formatMoney(sales)} de ${formatMoney(cap)} vendidos este mes`}
        </p>
        {usage !== null && (
          <div className="mt-2 h-1.5 max-w-sm overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${usage}%` }} />
          </div>
        )}
      </div>
      {informal && (
        <Link href="/vendedor/formalizar" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Subir mis límites <ArrowRight className="size-4" />
        </Link>
      )}
    </Card>
  );
}
