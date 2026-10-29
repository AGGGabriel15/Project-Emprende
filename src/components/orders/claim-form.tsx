"use client";

import { AlertTriangle, Camera, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/form-controls";
import { openClaim } from "@/features/orders/actions";
import { CLAIM_REASONS } from "@/features/orders/status";
import { downscaleImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import type { ClaimReason } from "@/types/domain";

/** Reclamo dentro de las 48 h: con fotos, la administración decide con la evidencia de cada paso. */
export function ClaimForm({ orderId, deadline }: { orderId: string; deadline: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ClaimReason>("damaged");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pending, startTransition] = useTransition();
  const needsPhoto = reason === "damaged" || reason === "wrong_item" || reason === "missing_items";

  function submit() {
    startTransition(async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Inicia sesión de nuevo.");
        const photos: string[] = [];
        for (const file of files) {
          const photo = await downscaleImage(file);
          const path = `${user.id}/claims/${crypto.randomUUID()}.${photo.type === "image/webp" ? "webp" : "png"}`;
          const { error } = await supabase.storage.from("delivery-evidence").upload(path, photo, { contentType: photo.type });
          if (error) throw error;
          photos.push(path);
        }
        const result = await openClaim({ orderId, reason, description, photos });
        if (!result.ok) throw new Error(result.error);
        toast.success("Recibimos tu reclamo. Lo revisaremos con la evidencia del envío.");
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No pudimos enviar el reclamo.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <AlertTriangle /> Reportar un problema
      </Button>
      <DialogContent
        side="sheet"
        title="Reportar un problema"
        description={`Puedes reportarlo hasta el ${deadline}. Comparamos tus fotos con las que tomamos al recoger y entregar el pedido.`}
      >
        <div className="space-y-4">
          <Field label="¿Qué pasó?" htmlFor="claim-reason">
            <Select id="claim-reason" value={reason} onChange={(e) => setReason(e.target.value as ClaimReason)}>
              {Object.entries(CLAIM_REASONS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cuéntanos los detalles" htmlFor="claim-description">
            <Textarea id="claim-description" rows={4} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-medium">
              Fotos {needsPhoto ? <span className="text-destructive">*</span> : <span className="text-muted-foreground">(opcional)</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {files.map((file, index) => (
                <span key={`${file.name}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">
                  {file.name}
                  <button type="button" aria-label="Quitar foto" className="cursor-pointer" onClick={() => setFiles(files.filter((_, i) => i !== index))}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {files.length < 3 && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed px-3 py-1 text-xs hover:border-primary hover:text-primary">
                  <Camera className="size-3.5" /> Agregar foto
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) setFiles([...files, file]);
                    }}
                  />
                </label>
              )}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <Button
              className="flex-1"
              loading={pending}
              disabled={description.trim().length < 10 || (needsPhoto && files.length === 0)}
              onClick={submit}
            >
              {pending ? <Loader2 className="animate-spin" /> : <AlertTriangle />} Enviar reclamo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
