import { Camera } from "lucide-react";
import { formatDate } from "@/lib/utils";

export type EvidenceItem = { label: string; url: string | undefined; at?: string | null; note?: string | null };

/** Fotos de cada paso (empaque, recolección, entrega): la base para resolver reclamos. */
export function EvidenceGallery({ items }: { items: EvidenceItem[] }) {
  const visible = items.filter((item) => item.url);
  if (!visible.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {visible.map((item) => (
        <a key={item.label} href={item.url} target="_blank" rel="noreferrer" className="group block">
          <span className="relative block aspect-square overflow-hidden rounded-xl border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt={item.label} className="h-full w-full object-cover transition group-hover:scale-105" />
            <span className="absolute top-1.5 left-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-white">
              <Camera className="size-3.5" />
            </span>
          </span>
          <span className="mt-1.5 block text-xs font-medium">{item.label}</span>
          {item.at && <span className="block text-xs text-muted-foreground">{formatDate(item.at)}</span>}
          {item.note && <span className="block text-xs text-muted-foreground">{item.note}</span>}
        </a>
      ))}
    </div>
  );
}
