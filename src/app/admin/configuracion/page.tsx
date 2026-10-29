import type { Metadata } from "next";
import { LimitsForm } from "@/components/admin/limits-form";
import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/ui/card";
import { stripeConfigured } from "@/features/payments/provider";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Configuración" };

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("key, value");
  const settings = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
  return (
    <div className="max-w-2xl">
      <PageHeader title="Configuración de la plataforma" />
      <SettingsForm
        settings={{
          commissionRate: Number(settings.commission_rate ?? 0.08),
          pendingMinutes: Number(settings.pending_payment_minutes ?? 30),
          supportEmail: String(settings.support_email ?? ""),
          supportWhatsapp: String(settings.support_whatsapp ?? ""),
        }}
        integrations={{
          payments: process.env.PAYMENTS_MODE !== "mock" && stripeConfigured() ? "Stripe (modo test)" : "Pasarela simulada",
          email: process.env.RESEND_API_KEY ? "Resend" : "Solo consola (sin RESEND_API_KEY)",
          sentry: process.env.NEXT_PUBLIC_SENTRY_DSN ? "Activo" : "Desactivado",
        }}
      />
      <LimitsForm
        values={{
          first_products_review: Number(settings.first_products_review ?? 10),
          informal_max_active_orders: Number(settings.informal_max_active_orders ?? 5),
          informal_monthly_cap_minor: Number(settings.informal_monthly_cap_minor ?? 2000000),
          informal_trusted_after_orders: Number(settings.informal_trusted_after_orders ?? 20),
          informal_trusted_max_active_orders: Number(settings.informal_trusted_max_active_orders ?? 15),
          informal_trusted_monthly_cap_minor: Number(settings.informal_trusted_monthly_cap_minor ?? 5000000),
          formal_max_active_orders: Number(settings.formal_max_active_orders ?? 30),
        }}
      />
    </div>
  );
}
