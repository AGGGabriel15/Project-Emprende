import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BusinessSettingsForm } from "@/components/vendor/business-settings-form";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { listCategories } from "@/features/catalog/queries";
import { requireApprovedBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Configuración" };

export default async function SettingsPage() {
  const { business } = await requireApprovedBusiness("/vendedor/configuracion");
  const supabase = await createClient();
  const [categories, { data: bank }, { data: rate }] = await Promise.all([
    listCategories(),
    supabase.from("business_bank_accounts").select("*").eq("business_id", business.id).maybeSingle(),
    supabase.rpc("commission_rate_for", { p_business: business.id }),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Configuración del negocio"
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={`/negocios/${business.slug}`} target="_blank">
              <ExternalLink /> Ver mi página
            </Link>
          </Button>
        }
      />
      <div className="space-y-6">
        <BusinessSettingsForm business={business} categories={categories} />
        <Card>
          <CardHeader title="Datos legales y de liquidación" description="Para cambiarlos, contacta a la administración." />
          <CardBody>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Info label="Razón social" value={business.legal_name} />
              <Info label="RUC" value={business.ruc} />
              <Info label="Régimen" value={business.tax_regime === "cuota_fija" ? "Cuota fija" : "Régimen general"} />
              <Info label="Matrícula" value={business.municipal_license} />
              <Info label="Comisión vigente" value={formatPercent(Number(rate ?? 0.08))} />
              <Info
                label="Cuenta bancaria"
                value={bank ? `${bank.bank_name} · ${bank.currency} · ****${String(bank.account_number).slice(-4)}` : "—"}
              />
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}
