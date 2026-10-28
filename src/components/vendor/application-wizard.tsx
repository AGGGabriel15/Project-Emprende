"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { LocationSelects } from "@/components/customer/location-selects";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { PhoneInput } from "@/components/ui/masked-inputs";
import { DocumentUploader, SingleImageUploader } from "@/components/upload/uploaders";
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
} from "@/lib/validations/business";
import type {
  BankAccount,
  Business,
  BusinessDocument,
  DocumentType,
  PlatformCategory,
} from "@/types/domain";

const STEPS = ["Datos legales", "Documentos", "Tu local", "Cuenta bancaria", "Enviar"];

export function ApplicationWizard({
  business,
  bank,
  documents,
  categories,
  commissionRate,
  ownerName,
}: {
  business: Business | null;
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
  const [storeSaved, setStoreSaved] = useState(Boolean(business?.category_id && business.address_line));

  const done = [hasBusiness, REQUIRED_DOCUMENTS.every((d) => docs.has(d.type)), storeSaved, hasBank, false];
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
            onSaved={() => {
              setHasBusiness(true);
              router.refresh();
              next();
            }}
          />
        )}
        {step === 1 && (
          <div className="space-y-5">
            <StepTitle title="Documentos de verificación" text="Se guardan en un almacenamiento privado: solo tú y la administración pueden verlos." />
            <div className="grid gap-3 sm:grid-cols-2">
              {REQUIRED_DOCUMENTS.map((doc) => (
                <DocumentUploader
                  key={doc.type}
                  label={doc.label}
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

function LegalStep({ business, ownerName, onSaved }: { business: Business | null; ownerName: string; onSaved: () => void }) {
  type Values = z.input<typeof legalStepSchema>;
  const form = useForm<Values>({
    resolver: zodResolver(legalStepSchema),
    defaultValues: {
      tradeName: business?.trade_name ?? "",
      legalName: business?.legal_name ?? ownerName,
      personType: business?.person_type ?? "natural",
      ruc: business?.ruc ?? "",
      taxRegime: business?.tax_regime ?? "cuota_fija",
      municipalLicense: business?.municipal_license ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async (values) => {
    const result = await saveLegalStep(values);
    if (!result.ok) return void toast.error(result.error);
    onSaved();
  });
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <StepTitle title="Datos legales" text="Como aparecen en la DGI y en la Alcaldía de Catarina." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre comercial" htmlFor="tradeName" error={errors.tradeName?.message} hint="Así te verán los clientes.">
          <Input id="tradeName" placeholder="Vivero Los Helechos" {...form.register("tradeName")} />
        </Field>
        <Field label="Razón social / propietario" htmlFor="legalName" error={errors.legalName?.message}>
          <Input id="legalName" {...form.register("legalName")} />
        </Field>
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
      </div>
      <StepNav submit loading={isSubmitting} />
    </form>
  );
}

function StoreStep({
  business,
  categories,
  onBack,
  onSaved,
}: {
  business: Business | null;
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
    },
  });
  const { errors, isSubmitting } = form.formState;
  const [departmentId, municipalityId, logoUrl, coverUrl] = useWatch({
    control: form.control,
    name: ["departmentId", "municipalityId", "logoUrl", "coverUrl"],
  });
  const submit = form.handleSubmit(async (values) => {
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
      <Field label="Dirección del local" htmlFor="addressLine" error={errors.addressLine?.message}>
        <Input id="addressLine" placeholder="Del mirador 1 c. al este" {...form.register("addressLine")} />
      </Field>
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
  ownerName,
  onBack,
  onSaved,
}: {
  bank: BankAccount | null;
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
        <Field label="Titular" htmlFor="accountHolder" error={errors.accountHolder?.message} className="sm:col-span-2">
          <Input id="accountHolder" {...form.register("accountHolder")} />
        </Field>
      </div>
      <StepNav submit onBack={onBack} loading={isSubmitting} />
    </form>
  );
}

function SubmitStep({
  ready,
  missing,
  commissionRate,
  onBack,
}: {
  ready: boolean;
  missing: string[];
  commissionRate: number;
  onBack: () => void;
}) {
  const router = useRouter();
  const [terms, setTerms] = useState(false);
  const [commission, setCommission] = useState(false);
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
          Sin mensualidad ni inscripción. Se calcula sobre el subtotal de productos; la tarifa de delivery
          pasa íntegra a tu negocio. Ejemplo: en un pedido de C$ 1,000 + C$ 80 de envío recibes C${" "}
          {(1000 - 1000 * commissionRate + 80).toLocaleString("es-NI")}.
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
      </div>
      <div className="flex justify-between gap-3 border-t pt-5">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft /> Atrás
        </Button>
        <Button
          disabled={!ready || !terms || !commission}
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
