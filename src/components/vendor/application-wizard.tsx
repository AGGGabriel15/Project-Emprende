"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronLeft, ChevronRight, FileBadge, Home, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { LocationSelects } from "@/components/customer/location-selects";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { PhoneInput } from "@/components/ui/masked-inputs";
import { DocumentUploader, SingleImageUploader } from "@/components/upload/uploaders";
import { GeoLocationField } from "./geo-location-field";
import {
  recordDocument,
  saveBankStep,
  saveLegalStep,
  saveStoreStep,
  submitApplication,
} from "@/features/businesses/actions";
import { cn, formatPercent } from "@/lib/utils";
import {
  BANKS,
  bankStepSchema,
  legalStepSchema,
  REQUIRED_DOCUMENTS,
  storeStepSchema,
  TIER_INFO,
} from "@/lib/validations/business";
import type {
  BankAccount,
  Business,
  BusinessDocument,
  BusinessTier,
  DocumentType,
  PlatformCategory,
} from "@/types/domain";

const STEPS = ["Tipo y datos", "Documentos", "Tu local", "Cuenta bancaria", "Enviar"];

export function ApplicationWizard({
  business,
  location,
  bank,
  documents,
  categories,
  commissionRate,
  ownerName,
}: {
  business: Business | null;
  location: { latitude: number | null; longitude: number | null } | null;
  bank: BankAccount | null;
  documents: BusinessDocument[];
  categories: PlatformCategory[];
  commissionRate: number;
  ownerName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [hasBusiness, setHasBusiness] = useState(Boolean(business));
  const [docs, setDocs] = useState<Set<DocumentType>>(new Set(documents.map((d) => d.doc_type)));
  const [hasBank, setHasBank] = useState(Boolean(bank));
  const [tier, setTier] = useState<BusinessTier>(business?.tier ?? "informal");
  const [storeSaved, setStoreSaved] = useState(
    Boolean(business?.category_id && business.address_line && (business.tier !== "informal" || location?.latitude != null)),
  );
  const requiredDocs = REQUIRED_DOCUMENTS[tier];

  const done = [hasBusiness, requiredDocs.every((d) => docs.has(d.type)), storeSaved, hasBank, false];
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));

  return (
    <div className="mt-6">
      <ol className="mb-6 grid grid-cols-5 gap-2">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              disabled={index > 0 && !hasBusiness}
              onClick={() => setStep(index)}
              className="group w-full cursor-pointer text-left disabled:cursor-not-allowed"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition",
                  index === step ? "bg-primary" : done[index] ? "bg-primary/50" : "bg-border",
                )}
              />
              <span className={cn("mt-2 hidden items-center gap-1 text-xs font-medium sm:flex", index === step ? "text-primary" : "text-muted-foreground")}>
                {done[index] && <Check className="size-3.5" />} {label}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mb-3 text-sm font-medium text-muted-foreground sm:hidden">
        Paso {step + 1} de {STEPS.length}: {STEPS[step]}
      </p>

      <Card className="p-5 sm:p-8">
        {step === 0 && (
          <LegalStep
            business={business}
            ownerName={ownerName}
            onSaved={(savedTier) => {
              setHasBusiness(true);
              setTier(savedTier);
              if (savedTier === "informal" && location?.latitude == null) setStoreSaved(false);
              router.refresh();
              next();
            }}
          />
        )}
        {step === 1 && (
          <div className="space-y-5">
            <StepTitle
              title="Documentos de verificación"
              text={
                tier === "informal"
                  ? "No necesitas RUC. Con tu cédula, una selfie y fotos de tu lugar confirmamos que eres tú y que el negocio existe. Luego te visitaremos."
                  : "Se guardan en un almacenamiento privado: solo tú y la administración pueden verlos."
              }
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {requiredDocs.map((doc) => (
                <DocumentUploader
                  key={doc.type}
                  label={doc.label}
                  hint={"hint" in doc ? doc.hint : undefined}
                  uploaded={docs.has(doc.type)}
                  onUploaded={async (path) => {
                    const result = await recordDocument({ docType: doc.type, filePath: path });
                    if (!result.ok) throw new Error(result.error);
                    setDocs((current) => new Set(current).add(doc.type));
                    toast.success(`${doc.label} recibido.`);
                  }}
                />
              ))}
            </div>
            <StepNav onBack={() => setStep(0)} onNext={next} nextDisabled={!done[1]} />
          </div>
        )}
        {step === 2 && (
          <StoreStep
            business={business}
            location={location}
            tier={tier}
            categories={categories}
            onBack={() => setStep(1)}
            onSaved={() => {
              setStoreSaved(true);
              next();
            }}
          />
        )}
        {step === 3 && (
          <BankStep
            bank={bank}
            tier={tier}
            ownerName={business?.legal_name ?? ownerName}
            onBack={() => setStep(2)}
            onSaved={() => {
              setHasBank(true);
              next();
            }}
          />
        )}
        {step === 4 && (
          <SubmitStep
            tier={tier}
            ready={done.slice(0, 4).every(Boolean)}
            missing={STEPS.slice(0, 4).filter((_, i) => !done[i])}
            commissionRate={commissionRate}
            onBack={() => setStep(3)}
          />
        )}
      </Card>
    </div>
  );
}

function StepTitle({ title, text }: { title: string; text?: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold">{title}</h2>
      {text && <p className="mt-1 text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}

function StepNav({
  onBack,
  onNext,
  nextDisabled,
  loading,
  submit,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  loading?: boolean;
  submit?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 border-t pt-5">
      {onBack ? (
        <Button type="button" variant="ghost" onClick={onBack}>
          <ChevronLeft /> Atrás
        </Button>
      ) : (
        <span />
      )}
      <Button type={submit ? "submit" : "button"} onClick={onNext} disabled={nextDisabled} loading={loading}>
        Guardar y seguir <ChevronRight />
      </Button>
    </div>
  );
}

function LegalStep({
  business,
  ownerName,
  onSaved,
}: {
  business: Business | null;
  ownerName: string;
  onSaved: (tier: BusinessTier) => void;
}) {
  type Values = z.input<typeof legalStepSchema>;
  type FormalValues = Extract<Values, { tier: "formal" }>;
  const form = useForm<Values>({
    resolver: zodResolver(legalStepSchema),
    defaultValues: {
      tier: business?.tier ?? "informal",
      tradeName: business?.trade_name ?? "",
      legalName: business?.legal_name ?? ownerName,
      personType: business?.person_type ?? "natural",
      ruc: business?.ruc ?? "",
      taxRegime: business?.tax_regime ?? "cuota_fija",
      municipalLicense: business?.municipal_license ?? "",
    } as Values,
  });
  const { isSubmitting } = form.formState;
  const errors = form.formState.errors as FieldErrors<FormalValues>;
  const tier = useWatch({ control: form.control, name: "tier" });
  const submit = form.handleSubmit(async (values) => {
    const result = await saveLegalStep(values);
    if (!result.ok) return void toast.error(result.error);
    onSaved(values.tier);
  });
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <StepTitle title="¿Cómo vendes?" text="Ambos pagan la misma comisión. El negocio formal tiene límites de venta más altos." />
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de vendedor">
        {(["informal", "formal"] as const).map((option) => {
          const Icon = option === "informal" ? Home : FileBadge;
          const active = tier === option;
          return (
            <label
              key={option}
              className={cn(
                "flex cursor-pointer gap-3 rounded-2xl border-2 p-4 transition",
                active ? "border-primary bg-primary-soft" : "border-border hover:border-primary/50",
              )}
            >
              <input type="radio" value={option} className="sr-only" {...form.register("tier")} />
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <Icon className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">{TIER_INFO[option].label}</span>
                <span className="block text-sm text-muted-foreground">{TIER_INFO[option].short}</span>
              </span>
            </label>
          );
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre del negocio" htmlFor="tradeName" error={errors.tradeName?.message} hint="Así te verán los clientes.">
          <Input id="tradeName" placeholder="Vivero Los Helechos" {...form.register("tradeName")} />
        </Field>
        <Field
          label={tier === "formal" ? "Razón social / propietario" : "Tu nombre completo (como en la cédula)"}
          htmlFor="legalName"
          error={errors.legalName?.message}
        >
          <Input id="legalName" {...form.register("legalName")} />
        </Field>
        {tier === "formal" && (
          <>
            <Field label="Tipo de persona" htmlFor="personType" error={errors.personType?.message}>
              <Select id="personType" {...form.register("personType")}>
                <option value="natural">Persona natural</option>
                <option value="juridica">Persona jurídica</option>
              </Select>
            </Field>
            <Field label="RUC (DGI)" htmlFor="ruc" error={errors.ruc?.message}>
              <Input id="ruc" placeholder="J0310000000001" {...form.register("ruc")} />
            </Field>
            <Field label="Régimen fiscal" htmlFor="taxRegime" error={errors.taxRegime?.message}>
              <Select id="taxRegime" {...form.register("taxRegime")}>
                <option value="cuota_fija">Cuota fija</option>
                <option value="regimen_general">Régimen general</option>
              </Select>
            </Field>
            <Field label="Matrícula de la Alcaldía" htmlFor="municipalLicense" error={errors.municipalLicense?.message}>
              <Input id="municipalLicense" {...form.register("municipalLicense")} />
            </Field>
          </>
        )}
      </div>
      {tier === "informal" && (
        <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          Te pediremos tu cédula, una selfie con ella y fotos de tu lugar, y haremos una visita antes de
          aprobarte. Cuando obtengas RUC y matrícula podrás pasar a Negocio formal desde tu panel.
        </p>
      )}
      <StepNav submit loading={isSubmitting} />
    </form>
  );
}

function StoreStep({
  business,
  location,
  tier,
  categories,
  onBack,
  onSaved,
}: {
  business: Business | null;
  location: { latitude: number | null; longitude: number | null } | null;
  tier: BusinessTier;
  categories: PlatformCategory[];
  onBack: () => void;
  onSaved: () => void;
}) {
  type Values = z.input<typeof storeStepSchema>;
  const form = useForm<Values>({
    resolver: zodResolver(storeStepSchema),
    defaultValues: {
      categoryId: business?.category_id ?? 0,
      description: business?.description ?? "",
      departmentId: business?.department_id ?? 11,
      municipalityId: business?.municipality_id ?? 0,
      addressLine: business?.address_line ?? "",
      phone: business?.phone ?? "",
      whatsapp: business?.whatsapp ?? "",
      logoUrl: business?.logo_url ?? "",
      coverUrl: business?.cover_url ?? "",
      latitude: location?.latitude != null ? Number(location.latitude) : null,
      longitude: location?.longitude != null ? Number(location.longitude) : null,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const [departmentId, municipalityId, logoUrl, coverUrl, latitude, longitude] = useWatch({
    control: form.control,
    name: ["departmentId", "municipalityId", "logoUrl", "coverUrl", "latitude", "longitude"],
  });
  const submit = form.handleSubmit(async (values) => {
    if (tier === "informal" && (values.latitude == null || values.longitude == null)) {
      return void toast.error("Marca la ubicación exacta de tu negocio.");
    }
    const result = await saveStoreStep(values);
    if (!result.ok) return void toast.error(result.error);
    onSaved();
  });
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <StepTitle title="Tu local" text="Lo que verán los clientes en tu página." />
      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <Field label="Logo">
          <SingleImageUploader label="Subir logo" value={logoUrl} onChange={(url) => form.setValue("logoUrl", url)} />
        </Field>
        <Field label="Foto del local (portada)">
          <SingleImageUploader label="Subir portada" aspect="aspect-[2.4/1]" value={coverUrl} onChange={(url) => form.setValue("coverUrl", url)} />
        </Field>
      </div>
      <Field label="Categoría principal" htmlFor="categoryId" error={errors.categoryId?.message}>
        <Select id="categoryId" {...form.register("categoryId")}>
          <option value={0} disabled>
            Elige…
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Descripción" htmlFor="description" error={errors.description?.message}>
        <Textarea id="description" rows={4} placeholder="Qué haces, desde cuándo, qué te hace especial…" {...form.register("description")} />
      </Field>
      <LocationSelects
        idPrefix="store"
        departmentId={Number(departmentId) || null}
        municipalityId={Number(municipalityId) || null}
        errors={{ departmentId: errors.departmentId?.message, municipalityId: errors.municipalityId?.message }}
        onChange={(value) => {
          form.setValue("departmentId", value.departmentId);
          form.setValue("municipalityId", value.municipalityId);
        }}
      />
      <Field label="Dirección y punto de referencia" htmlFor="addressLine" error={errors.addressLine?.message}>
        <Input id="addressLine" placeholder="Del mirador 1 c. al este, casa verde" {...form.register("addressLine")} />
      </Field>
      <GeoLocationField
        latitude={latitude}
        longitude={longitude}
        required={tier === "informal"}
        onChange={(value) => {
          form.setValue("latitude", value.latitude);
          form.setValue("longitude", value.longitude);
        }}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Teléfono" htmlFor="phone" error={errors.phone?.message}>
          <Controller
            control={form.control}
            name="phone"
            render={({ field }) => (
              <PhoneInput id="phone" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={Boolean(errors.phone)} />
            )}
          />
        </Field>
        <Field label="WhatsApp (opcional)" htmlFor="whatsapp" error={errors.whatsapp?.message}>
          <Controller
            control={form.control}
            name="whatsapp"
            render={({ field }) => (
              <PhoneInput id="whatsapp" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={Boolean(errors.whatsapp)} />
            )}
          />
        </Field>
      </div>
      <StepNav submit onBack={onBack} loading={isSubmitting} />
    </form>
  );
}

function BankStep({
  bank,
  tier,
  ownerName,
  onBack,
  onSaved,
}: {
  bank: BankAccount | null;
  tier: BusinessTier;
  ownerName: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  type Values = z.input<typeof bankStepSchema>;
  const form = useForm<Values>({
    resolver: zodResolver(bankStepSchema),
    defaultValues: {
      bankName: bank?.bank_name ?? "",
      accountType: bank?.account_type ?? "ahorro",
      currency: bank?.currency ?? "NIO",
      accountNumber: bank?.account_number ?? "",
      accountHolder: bank?.account_holder ?? ownerName,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async (values) => {
    const result = await saveBankStep(values);
    if (!result.ok) return void toast.error(result.error);
    onSaved();
  });
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <StepTitle title="Cuenta para liquidaciones" text="Aquí depositamos tus ventas menos la comisión. Solo tú y la administración la ven." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Banco" htmlFor="bankName" error={errors.bankName?.message}>
          <Select id="bankName" {...form.register("bankName")}>
            <option value="" disabled>
              Elige…
            </option>
            {BANKS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo de cuenta" htmlFor="accountType">
          <Select id="accountType" {...form.register("accountType")}>
            <option value="ahorro">Ahorro</option>
            <option value="corriente">Corriente</option>
          </Select>
        </Field>
        <Field label="Moneda" htmlFor="currency">
          <Select id="currency" {...form.register("currency")}>
            <option value="NIO">Córdobas (C$)</option>
            <option value="USD">Dólares (US$)</option>
          </Select>
        </Field>
        <Field label="Número de cuenta" htmlFor="accountNumber" error={errors.accountNumber?.message}>
          <Input id="accountNumber" inputMode="numeric" {...form.register("accountNumber")} />
        </Field>
        <Field
          label="Titular"
          htmlFor="accountHolder"
          error={errors.accountHolder?.message}
          hint={tier === "informal" ? "Debe ser la misma persona de la cédula: no pagamos a cuentas de terceros." : undefined}
          className="sm:col-span-2"
        >
          <Input id="accountHolder" {...form.register("accountHolder")} />
        </Field>
      </div>
      <StepNav submit onBack={onBack} loading={isSubmitting} />
    </form>
  );
}

function SubmitStep({
  tier,
  ready,
  missing,
  commissionRate,
  onBack,
}: {
  tier: BusinessTier;
  ready: boolean;
  missing: string[];
  commissionRate: number;
  onBack: () => void;
}) {
  const router = useRouter();
  const [terms, setTerms] = useState(false);
  const [commission, setCommission] = useState(false);
  const [declaration, setDeclaration] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-5">
      <StepTitle title="Revisa y envía" />
      {!ready && (
        <p className="rounded-xl bg-warning-soft p-3 text-sm">Te falta completar: {missing.join(", ")}.</p>
      )}
      <div className="rounded-2xl bg-muted p-4 text-sm">
        <p className="font-semibold">Comisión vigente: {formatPercent(commissionRate)} por pedido</p>
        <p className="mt-1 text-muted-foreground">
          Sin mensualidad ni inscripción. Se calcula sobre los productos. Catarina Market cobra el envío al
          cliente, envía a sus repartidores y te paga 48 h después de la entrega. Ejemplo: en un pedido de
          C$ 1,000 en productos recibes C$ {(1000 - 1000 * commissionRate).toLocaleString("es-NI")}.
        </p>
      </div>
      <div className="space-y-3">
        <Checkbox
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          label={
            <>
              Acepto los{" "}
              <a href="/terminos" target="_blank" className="text-primary underline">
                términos y condiciones
              </a>{" "}
              para vendedores.
            </>
          }
        />
        <Checkbox
          checked={commission}
          onChange={(e) => setCommission(e.target.checked)}
          label={`Acepto la comisión de ${formatPercent(commissionRate)} por pedido.`}
        />
        <Checkbox
          checked={declaration}
          onChange={(e) => setDeclaration(e.target.checked)}
          label={
            <>
              <strong>Declaración jurada:</strong> los datos y documentos son verdaderos; vendo productos propios o
              de procedencia legítima; acepto la inspección de cada pedido al recogerlo
              {tier === "informal" ? ", la visita de verificación" : ""} y que Catarina Market retenga el pago hasta
              confirmar la entrega. Si incumplo, acepto faltas, suspensión y el descuento de reembolsos de mis
              liquidaciones.
            </>
          }
        />
      </div>
      <div className="flex justify-between gap-3 border-t pt-5">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft /> Atrás
        </Button>
        <Button
          disabled={!ready || !terms || !commission || !declaration}
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await submitApplication(commissionRate);
              if (!result.ok) return void toast.error(result.error);
              toast.success("¡Solicitud enviada! Te avisaremos cuando sea revisada.");
              router.refresh();
            })
          }
        >
          <Send /> Enviar solicitud
        </Button>
      </div>
    </div>
  );
}
