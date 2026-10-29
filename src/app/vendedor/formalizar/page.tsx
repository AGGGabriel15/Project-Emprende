import { BadgeCheck, Hourglass } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { FormalUpgradeForm } from "@/components/vendor/formal-upgrade-form";
import { requireApprovedBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { DocumentType } from "@/types/domain";

export const metadata: Metadata = { title: "Pasar a Negocio formal" };

const BENEFITS = [
  "Hasta 30 pedidos en curso y sin tope de ventas al mes.",
  "Liquidación semanal sin retención extra de 7 días.",
  "Sello “Negocio formal” en tu página.",
  "La comisión no cambia.",
];

export default async function FormalizePage() {
  const { business } = await requireApprovedBusiness("/vendedor/formalizar");
  const supabase = await createClient();
  const { data: docs } = await supabase
    .from("business_documents")
    .select("doc_type")
    .eq("business_id", business.id)
    .in("doc_type", ["ruc", "municipal_license"]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Pasar a Negocio formal" description="Cuando tengas RUC y matrícula de la Alcaldía, súbelos aquí." />
      {business.tier === "formal" ? (
        <Card className="flex items-center gap-3 p-6">
          <BadgeCheck className="size-8 text-primary" />
          <p className="font-medium">Tu negocio ya es formal. ¡Gracias por formalizarte!</p>
        </Card>
      ) : business.upgrade_requested_at ? (
        <Card className="flex items-center gap-3 p-6">
          <Hourglass className="size-8 text-warning" />
          <p>
            Tu solicitud está en revisión desde el {formatDate(business.upgrade_requested_at)}. Te avisaremos en tus
            notificaciones.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Beneficios" />
            <CardBody>
              <ul className="space-y-1.5 text-sm">
                {BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex gap-2">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" /> {benefit}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Datos fiscales" />
            <CardBody>
              <FormalUpgradeForm uploaded={(docs ?? []).map((d) => d.doc_type as DocumentType)} />
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
