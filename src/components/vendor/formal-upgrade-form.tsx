"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { DocumentUploader } from "@/components/upload/uploaders";
import { recordDocument, requestFormalUpgrade } from "@/features/businesses/actions";
import { formalUpgradeSchema, UPGRADE_DOCUMENTS } from "@/lib/validations/business";
import type { DocumentType } from "@/types/domain";

type Values = z.input<typeof formalUpgradeSchema>;

export function FormalUpgradeForm({ uploaded }: { uploaded: DocumentType[] }) {
  const router = useRouter();
  const [docs, setDocs] = useState(new Set(uploaded));
  const form = useForm<Values>({
    resolver: zodResolver(formalUpgradeSchema),
    defaultValues: { personType: "natural", ruc: "", taxRegime: "cuota_fija", municipalLicense: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const docsReady = UPGRADE_DOCUMENTS.every((d) => docs.has(d.type));

  const submit = form.handleSubmit(async (values) => {
    const result = await requestFormalUpgrade(values);
    if (!result.ok) return void toast.error(result.error);
    toast.success("Solicitud enviada. Te avisaremos cuando la revisemos.");
    router.refresh();
  });

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de persona" htmlFor="personType">
          <Select id="personType" {...form.register("personType")}>
            <option value="natural">Persona natural</option>
            <option value="juridica">Persona jurídica</option>
          </Select>
        </Field>
        <Field label="RUC (DGI)" htmlFor="ruc" error={errors.ruc?.message}>
          <Input id="ruc" placeholder="J0310000000001" {...form.register("ruc")} />
        </Field>
        <Field label="Régimen fiscal" htmlFor="taxRegime">
          <Select id="taxRegime" {...form.register("taxRegime")}>
            <option value="cuota_fija">Cuota fija</option>
            <option value="regimen_general">Régimen general</option>
          </Select>
        </Field>
        <Field label="Matrícula de la Alcaldía" htmlFor="municipalLicense" error={errors.municipalLicense?.message}>
          <Input id="municipalLicense" {...form.register("municipalLicense")} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {UPGRADE_DOCUMENTS.map((doc) => (
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
      <div className="flex justify-end border-t pt-5">
        <Button type="submit" loading={isSubmitting} disabled={!docsReady}>
          <Send /> Solicitar formalización
        </Button>
      </div>
    </form>
  );
}
