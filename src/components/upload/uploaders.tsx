"use client";

import { Camera, FileCheck2, ImagePlus, Loader2, Trash2, Upload, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/layout/account-menu";
import { Button } from "@/components/ui/button";
import { updateAvatar } from "@/features/account/actions";
import { cn } from "@/lib/utils";

type Bucket = "product-images" | "business-media" | "business-documents" | "avatars";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Sube a <bucket>/<user_id>/<carpeta>/<uuid>.ext (las políticas exigen la carpeta del usuario). */
async function upload(bucket: Bucket, folder: string, file: File) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Inicia sesión para subir archivos.");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${user.id}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
  });
  if (error) throw error;
  const publicUrl = bucket === "business-documents" ? null : supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return { path, publicUrl };
}

function check(file: File, types: string[], maxMb: number) {
  if (!types.includes(file.type)) throw new Error("Formato no permitido.");
  if (file.size > maxMb * 1024 * 1024) throw new Error(`El archivo supera ${maxMb} MB.`);
}

/** Galería de fotos con orden (la primera es la portada). */
export function ImagesUploader({
  value,
  onChange,
  max = 6,
  bucket = "product-images",
  folder = "products",
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  bucket?: Bucket;
  folder?: string;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const room = max - value.length;
      const uploaded: string[] = [];
      for (const file of [...files].slice(0, room)) {
        check(file, IMAGE_TYPES, 5);
        const { publicUrl } = await upload(bucket, folder, file);
        uploaded.push(publicUrl!);
      }
      onChange([...value, ...uploaded]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos subir la imagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {value.map((url, index) => (
        <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border bg-muted">
          <Image src={url} alt="" fill sizes="160px" className="object-cover" />
          {index === 0 && (
            <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
              Portada
            </span>
          )}
          <div className="absolute top-1.5 right-1.5 flex gap-1">
            {index > 0 && (
              <button
                type="button"
                className="cursor-pointer rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white"
                onClick={() => onChange([url, ...value.filter((u) => u !== url)])}
              >
                Portada
              </button>
            )}
            <button
              type="button"
              aria-label="Quitar foto"
              className="grid size-6 cursor-pointer place-items-center rounded-full bg-black/60 text-white"
              onClick={() => onChange(value.filter((u) => u !== url))}
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ))}
      {value.length < max && (
        <label
          htmlFor={id}
          className={cn(
            "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-xs text-muted-foreground transition hover:border-primary hover:text-primary",
            busy && "pointer-events-none opacity-60",
          )}
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          {busy ? "Subiendo…" : "Agregar foto"}
          <input
            id={id}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            multiple
            className="sr-only"
            onChange={(event) => {
              void handle(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}

/** Una sola imagen (logo o portada del negocio). */
export function SingleImageUploader({
  value,
  onChange,
  label,
  aspect = "aspect-square",
}: {
  value?: string | null;
  onChange: (url: string) => void;
  label: string;
  aspect?: string;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  return (
    <label
      htmlFor={id}
      className={cn(
        "relative flex cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border-2 border-dashed bg-muted/40 text-xs text-muted-foreground transition hover:border-primary hover:text-primary",
        aspect,
      )}
    >
      {value ? (
        <Image src={value} alt={label} fill sizes="320px" className="object-cover" />
      ) : busy ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <>
          <ImagePlus className="size-5" /> {label}
        </>
      )}
      {value && (
        <span className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
          Cambiar
        </span>
      )}
      <input
        id={id}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        className="sr-only"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            check(file, IMAGE_TYPES, 5);
            const { publicUrl } = await upload("business-media", "media", file);
            onChange(publicUrl!);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "No pudimos subir la imagen.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </label>
  );
}

/** Documento privado (RUC, cédula, matrícula): devuelve la ruta en el bucket. */
export function DocumentUploader({
  label,
  hint,
  uploaded,
  onUploaded,
  disabled,
}: {
  label: string;
  hint?: string;
  uploaded: boolean;
  onUploaded: (path: string) => Promise<void> | void;
  disabled?: boolean;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition hover:border-primary",
        uploaded && "border-success/40 bg-success-soft/40",
        (busy || disabled) && "pointer-events-none opacity-60",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          uploaded ? "bg-success text-white" : "bg-muted text-muted-foreground",
        )}
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : uploaded ? <FileCheck2 className="size-5" /> : <Upload className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">
          {uploaded ? "Recibido · toca para reemplazar" : (hint ?? "JPG, PNG, WebP o PDF · máx. 10 MB")}
        </span>
      </span>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="sr-only"
        disabled={disabled}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            check(file, [...IMAGE_TYPES, "application/pdf"], 10);
            const { path } = await upload("business-documents", "docs", file);
            await onUploaded(path);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "No pudimos subir el documento.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </label>
  );
}

/** Recorta al centro y reduce a un cuadrado (las fotos del celular pesan varios MB). */
async function squareImage(file: File, size: number) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(size, side);
  canvas
    .getContext("2d")!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("No pudimos procesar la imagen.");
  const ext = blob.type === "image/webp" ? "webp" : "png";
  return new File([blob], `avatar.${ext}`, { type: blob.type });
}

/** Foto de perfil: sube a avatars/<user_id>/ y la guarda en el perfil. */
export function AvatarUploader({ name, url }: { name: string; url: string | null }) {
  const id = useId();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function save(next: string | null) {
    const result = await updateAvatar(next);
    if (!result.ok) throw new Error(result.error);
    router.refresh();
  }

  async function handle(file: File) {
    setBusy(true);
    try {
      check(file, IMAGE_TYPES, 15);
      const { publicUrl } = await upload("avatars", "avatar", await squareImage(file, 512));
      await save(publicUrl);
      toast.success("Foto de perfil actualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos subir la foto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <label htmlFor={id} className="group relative cursor-pointer rounded-full" aria-label="Cambiar foto de perfil">
        <Avatar name={name} url={url} className="size-24 text-2xl" />
        <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
          <Camera className="size-6" />
        </span>
        {busy && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white">
            <Loader2 className="size-6 animate-spin" />
          </span>
        )}
        <span className="absolute right-0 bottom-0 grid size-8 place-items-center rounded-full bg-primary text-primary-foreground ring-3 ring-card">
          <Camera className="size-4" />
        </span>
        <input
          id={id}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handle(file);
          }}
        />
      </label>
      <div className="space-y-2">
        <p className="text-sm font-medium">Foto de perfil</p>
        <p className="text-xs text-muted-foreground">JPG, PNG o WebP. La recortamos en cuadrado.</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" disabled={busy}>
            <label htmlFor={id} className="cursor-pointer">
              <Camera /> {url ? "Cambiar foto" : "Subir foto"}
            </label>
          </Button>
          {url && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await save(null);
                  toast.success("Foto eliminada.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "No pudimos quitar la foto.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 /> Quitar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
