import Link from "next/link";
import { cn } from "@/lib/utils";

export const PERIODS = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "90d", label: "90 días" },
  { value: "365d", label: "12 meses" },
];

/** Selector de rango en una fila, encima de los gráficos; vive en la URL. */
export function PeriodFilter({ basePath, active }: { basePath: string; active: string }) {
  return (
    <nav className="inline-flex gap-1 rounded-full bg-muted p-1" aria-label="Período">
      {PERIODS.map((p) => (
        <Link
          key={p.value}
          href={`${basePath}?periodo=${p.value}`}
          aria-current={active === p.value ? "page" : undefined}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
            active === p.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
