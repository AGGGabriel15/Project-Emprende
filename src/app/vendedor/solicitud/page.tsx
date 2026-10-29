import { CheckCircle2, Hourglass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ApplicationWizard } from "@/components/vendor/application-wizard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listCategories } from "@/features/catalog/queries";
import { getMyBusiness, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { BankAccount, BusinessDocument } from "@/types/domain";

export const metadata: Metadata = { title: "Solicitud del negocio" };

export default async function ApplicationPage() {
  const { profile } = await requireProfile(undefined, "/vendedor/solicitud");
  const business = await getMyBusiness();
  const supabase = await createClient();
  const [categories, { data: rateSetting }] = await Promise.all([
    listCategories(),
    supabase.from("platform_settings").select("value").eq("key", "commission_rate").maybeSingle(),
  ]);
  const commissionRate = Number(rateSetting?.value ?? 0.08);

  if (business?.status === "pending") {
    return (
      <StatusCard
        icon={<Hourglass className="size-7" />}
        title="Tu solicitud está en revisión"
        text={`Enviada el ${business.submitted_at ? formatDate(business.submitted_at) : "—"}. Te avisaremos por correo y en tus notificaciones cuando la administración la revise.`}
      />
    );
  }
  if (business?.status === "approved" || business?.status === "suspended") {
    return (
      <StatusCard
        icon={<CheckCircle2 className="size-7" />}
        title="Tu negocio está aprobado"
        text="Ya puedes publicar productos y recibir pedidos."
        action={
          <Button asChild>
            <Link href="/vendedor/panel">Ir al panel</Link>
          </Button>
        }
      />
    );
  }

  const [{ data: bank }, { data: documents }, { data: location }] = business
    ? await Promise.all([
        supabase.from("business_bank_accounts").select("*").eq("business_id", business.id).maybeSingle(),
        supabase.from("business_documents").select("*").eq("business_id", business.id),
        supabase.from("business_private").select("latitude, longitude").eq("business_id", business.id).maybeSingle(),
      ])
    : [{ data: null }, { data: [] }, { data: null }];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold sm:text-3xl">Registra tu negocio</h1>
      <p className="mt-1 text-muted-foreground">
        Completa los 5 pasos. Puedes vender aunque no tengas RUC: guardamos tu avance en cada paso.
      </p>
      {business?.status === "rejected" && (
        <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive-soft p-4 text-sm">
          <p className="font-semibold text-destructive">La solicitud fue rechazada</p>
          <p className="mt-1">Motivo: {business.rejection_reason}</p>
          <p className="mt-1 text-muted-foreground">Corrige lo indicado y vuelve a enviarla.</p>
        </div>
      )}
      <ApplicationWizard
        business={business}
        location={location}
        bank={bank as BankAccount | null}
        documents={(documents ?? []) as BusinessDocument[]}
        categories={categories}
        commissionRate={commissionRate}
        ownerName={profile.full_name}
      />
    </div>
  );
}

function StatusCard({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="mx-auto max-w-lg p-8 text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary-soft text-primary">{icon}</div>
      <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted-foreground">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </Card>
  );
}
