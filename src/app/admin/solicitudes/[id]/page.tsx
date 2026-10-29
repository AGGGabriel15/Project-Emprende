import { AlertTriangle, ArrowLeft, Check, ExternalLink, MapPinCheck, X } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, PromptActionButton } from "@/components/admin/action-buttons";
import { DocumentLink } from "@/components/admin/document-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { recordVerificationVisit, reviewApplication, reviewFormalUpgrade } from "@/features/admin/actions";
import { getGeo, placeName } from "@/features/location/server";
import { mapsUrl } from "@/lib/maps";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPercent } from "@/lib/utils";
import { REQUIRED_DOCUMENTS, TIER_INFO, UPGRADE_DOCUMENTS } from "@/lib/validations/business";
import type { BankAccount, Business, BusinessDocument, BusinessPrivate } from "@/types/domain";

export const metadata: Metadata = { title: "Revisar solicitud" };

type Params = Promise<{ id: string }>;

const STATUS = {
  draft: ["Borrador", "gray"],
  pending: ["Pendiente", "amber"],
  approved: ["Aprobado", "green"],
  rejected: ["Rechazado", "red"],
  suspended: ["Suspendido", "red"],
} as const;

const VISIT_CHECKLIST = [
  "La dirección y la ubicación del mapa corresponden al lugar.",
  "La persona coincide con la cédula y la selfie.",
  "Los productos existen y coinciden con las fotos.",
  "Puede empacar los pedidos y entregarlos al repartidor.",
];

// Compara nombres sin tildes, mayúsculas ni espacios extra.
const normalize = (value: string | null | undefined) =>
  (value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

export default async function ApplicationDetail({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, { data: documents }, { data: bank }, { data: privateData }, geo] = await Promise.all([
    supabase
      .from("businesses")
      .select("*, category:platform_categories(name), owner:profiles!businesses_owner_id_fkey(full_name, email, phone, cedula)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("business_documents").select("*").eq("business_id", id),
    supabase.from("business_bank_accounts").select("*").eq("business_id", id).maybeSingle(),
    supabase.from("business_private").select("*").eq("business_id", id).maybeSingle(),
    getGeo(),
  ]);
  if (!data) notFound();
  const business = data as Business & {
    category: { name: string } | null;
    owner: { full_name: string; email: string; phone: string | null; cedula: string | null };
  };
  const docs = (documents ?? []) as BusinessDocument[];
  const account = bank as BankAccount | null;
  const privateInfo = privateData as BusinessPrivate | null;
  const [statusLabel, tone] = STATUS[business.status];
  const informal = business.tier === "informal";
  const needsVisit = informal && !business.verification_visit_at;
  const holderMatches = account ? normalize(account.account_holder) === normalize(business.legal_name) : null;
  const requiredDocs = [
    ...REQUIRED_DOCUMENTS[business.tier],
    ...(business.upgrade_requested_at ? UPGRADE_DOCUMENTS : []),
  ];

  return (
    <div className="max-w-4xl">
      <Link href="/admin/solicitudes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" /> Solicitudes
      </Link>
      <PageHeader
        title={business.trade_name}
        description={business.submitted_at ? `Enviada el ${formatDate(business.submitted_at)}` : undefined}
        action={
          <div className="flex gap-2">
            <Badge tone={informal ? "violet" : "brand"}>{TIER_INFO[business.tier].label}</Badge>
            <Badge tone={tone}>{statusLabel}</Badge>
          </div>
        }
      />

      {business.status === "pending" && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="max-w-md text-sm text-muted-foreground">
            {informal
              ? needsVisit
                ? "Emprendedor informal: registra la visita de verificación antes de aprobar."
                : "Visita registrada. Revisa la cédula, la selfie y las fotos del lugar."
              : "Verifica que el RUC, la cédula y la matrícula coincidan con los datos declarados."}
          </p>
          <div className="flex gap-2">
            <PromptActionButton
              variant="danger"
              title="Rechazar solicitud"
              description="El vendedor verá este motivo y podrá corregir y reenviar."
              label="Motivo del rechazo"
              placeholder="Ej.: la foto de la cédula está borrosa"
              confirmLabel="Rechazar"
              success="Solicitud rechazada y notificada."
              action={async (reason: string) => {
                "use server";
                return reviewApplication({ businessId: id, decision: "rejected", reason });
              }}
            >
              <X /> Rechazar
            </PromptActionButton>
            <ActionButton
              disabled={needsVisit}
              confirm={`¿Aprobar ${business.trade_name}? Podrá publicar de inmediato.`}
              success="Negocio aprobado y notificado."
              action={reviewApplication.bind(null, { businessId: business.id, decision: "approved" })}
            >
              <Check /> Aprobar
            </ActionButton>
          </div>
        </Card>
      )}

      {business.upgrade_requested_at && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 border-info/30 bg-info-soft p-4">
          <p className="max-w-md text-sm">
            <strong>Solicita pasar a Negocio formal</strong> desde el {formatDate(business.upgrade_requested_at)}.
            Revisa el RUC {business.ruc} y la matrícula {business.municipal_license}.
          </p>
          <div className="flex gap-2">
            <PromptActionButton
              variant="danger"
              title="Rechazar formalización"
              label="Motivo"
              confirmLabel="Rechazar"
              success="Formalización rechazada."
              action={async (reason: string) => {
                "use server";
                return reviewFormalUpgrade(id, false, reason);
              }}
            >
              <X /> Rechazar
            </PromptActionButton>
            <ActionButton
              confirm="¿Aprobar el paso a Negocio formal?"
              success="Ahora es Negocio formal."
              action={reviewFormalUpgrade.bind(null, business.id, true, undefined)}
            >
              <Check /> Aprobar formalización
            </ActionButton>
          </div>
        </Card>
      )}

      {business.rejection_reason && (
        <p className="mb-6 rounded-xl bg-destructive-soft p-3 text-sm">Último rechazo: {business.rejection_reason}</p>
      )}

      {informal && (
        <Card className="mb-6">
          <CardHeader
            title="Visita de verificación"
            description="Obligatoria para emprendedores informales. Queda en la auditoría con tu usuario."
          />
          <CardBody className="space-y-4">
            {business.verification_visit_at ? (
              <div className="flex gap-3 rounded-xl bg-success-soft p-4 text-sm">
                <MapPinCheck className="size-5 shrink-0 text-success" />
                <div>
                  <p className="font-semibold">Visitado el {formatDate(business.verification_visit_at)}</p>
                  <p className="mt-1 whitespace-pre-line text-muted-foreground">{privateInfo?.visit_notes}</p>
                </div>
              </div>
            ) : (
              <>
                <ul className="space-y-1.5 text-sm">
                  {VISIT_CHECKLIST.map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {item}
                    </li>
                  ))}
                </ul>
                <PromptActionButton
                  title="Registrar visita"
                  description="Describe lo que verificaste en el lugar."
                  label="Notas de la visita"
                  placeholder="Ej.: casa con vivero en el patio, 40+ plantas, coincide con fotos; la dueña mostró su cédula."
                  minLength={10}
                  confirmLabel="Registrar visita"
                  success="Visita registrada."
                  action={async (notes: string) => {
                    "use server";
                    return recordVerificationVisit(id, notes);
                  }}
                >
                  <MapPinCheck /> Registrar visita realizada
                </PromptActionButton>
              </>
            )}
          </CardBody>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title={informal ? "Identidad" : "Datos legales"} />
          <CardBody>
            <Info
              items={[
                [informal ? "Nombre (cédula)" : "Razón social", business.legal_name],
                ...(informal
                  ? []
                  : ([
                      ["Tipo de persona", business.person_type === "juridica" ? "Jurídica" : "Natural"],
                      ["RUC", business.ruc],
                      ["Régimen", business.tax_regime === "cuota_fija" ? "Cuota fija" : "Régimen general"],
                      ["Matrícula Alcaldía", business.municipal_license],
                    ] as [string, string | null][])),
                ["Comisión aceptada", business.accepted_commission_rate !== null ? formatPercent(Number(business.accepted_commission_rate)) : "—"],
                ["Declaración jurada", business.declaration_accepted_at ? formatDate(business.declaration_accepted_at) : "—"],
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Propietario" />
          <CardBody>
            <Info items={[
              ["Nombre", business.owner.full_name],
              ["Correo", business.owner.email],
              ["Teléfono", business.owner.phone && formatPhone(business.owner.phone)],
              ["Cédula (perfil)", business.owner.cedula],
            ]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Documentos" description="Se abren con un enlace temporal de 10 minutos." />
          <CardBody className="space-y-2">
            {requiredDocs.map((required) => {
              const doc = docs.find((d) => d.doc_type === required.type);
              return (
                <div key={required.type} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm">
                  <span>{required.label}</span>
                  {doc ? <DocumentLink path={doc.file_path} /> : <Badge tone="red">Falta</Badge>}
                </div>
              );
            })}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Local y liquidaciones" />
          <CardBody className="space-y-3">
            <Info items={[
              ["Categoría", business.category?.name],
              ["Ubicación", placeName(geo, business.municipality_id)],
              ["Dirección", business.address_line],
              ["Teléfono / WhatsApp", [business.phone, business.whatsapp].filter(Boolean).map((p) => formatPhone(p)).join(" · ")],
              ["Banco", account ? `${account.bank_name} · ${account.account_type} · ${account.currency}` : "—"],
              ["Cuenta", account ? `${account.account_number} (${account.account_holder})` : "—"],
            ]} />
            {privateInfo?.latitude != null && privateInfo.longitude != null && (
              <a
                href={mapsUrl(privateInfo.latitude, privateInfo.longitude)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Ver ubicación exacta en el mapa <ExternalLink className="size-3.5" />
              </a>
            )}
            {holderMatches === false && (
              <p className="flex gap-2 rounded-xl bg-warning-soft p-3 text-sm">
                <AlertTriangle className="size-4 shrink-0 text-warning" />
                El titular de la cuenta no coincide con {informal ? "el nombre de la cédula" : "la razón social"}.
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Presentación" />
        <CardBody className="space-y-4">
          <div className="flex gap-4">
            {business.logo_url && <Image src={business.logo_url} alt="Logo" width={80} height={80} className="size-20 rounded-2xl object-cover" />}
            {business.cover_url && <Image src={business.cover_url} alt="Portada" width={320} height={130} className="h-20 w-auto rounded-2xl object-cover" />}
          </div>
          <p className="text-sm whitespace-pre-line text-muted-foreground">{business.description || "Sin descripción."}</p>
        </CardBody>
      </Card>
    </div>
  );
}

function Info({ items }: { items: [string, string | null | undefined][] }) {
  return (
    <dl className="space-y-2 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right font-medium break-all">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
