import { Flower2, Gem, Lamp, Package, Palette, Sprout } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export const CATEGORY_ICONS = {
  palette: Palette,
  sprout: Sprout,
  "flower-2": Flower2,
  lamp: Lamp,
  gem: Gem,
  package: Package,
} as const;

export function CategoryIcon({ icon, className }: { icon?: string | null; className?: string }) {
  const Icon = CATEGORY_ICONS[(icon ?? "package") as keyof typeof CATEGORY_ICONS] ?? Package;
  return <Icon className={className} aria-hidden />;
}

/** Foto del producto o, si no hay, un fondo con el ícono de la categoría. */
export function ProductImage({
  src,
  alt,
  icon,
  className,
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
  priority,
}: {
  src?: string | null;
  alt: string;
  icon?: string | null;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary-soft via-secondary to-accent-soft">
          <CategoryIcon icon={icon} className="size-1/4 max-h-16 max-w-16 text-primary/40" />
        </div>
      )}
    </div>
  );
}
