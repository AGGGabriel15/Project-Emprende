import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Rating({
  value,
  count,
  className,
}: {
  value: number;
  count?: number;
  className?: string;
}) {
  if (!count) {
    return <span className={cn("text-xs text-muted-foreground", className)}>Nuevo</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", className)}>
      <Star className="size-3.5 fill-warning text-warning" aria-hidden />
      {Number(value).toFixed(1)}
      <span className="text-muted-foreground">({count})</span>
    </span>
  );
}

export function Stars({ value, size = "size-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(size, n <= value ? "fill-warning text-warning" : "text-border")}
          aria-hidden
        />
      ))}
    </span>
  );
}
