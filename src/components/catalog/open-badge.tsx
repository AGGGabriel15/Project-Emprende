import { Clock } from "lucide-react";
import type { OpenState } from "@/features/businesses/hours";
import { cn } from "@/lib/utils";

/** "Abierto · Cierra a las 5:00 p. m." / "Cerrado · Abre mañana a las 8:00 a. m." */
export function OpenBadge({ state, className }: { state: OpenState; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        state.open ? "text-success" : "text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn("size-2 rounded-full", state.open ? "bg-success" : "bg-muted-foreground/50")}
        aria-hidden
      />
      <span>
        <span className="font-semibold">{state.label}</span>
        {state.detail && <span className="font-normal"> · {state.detail}</span>}
      </span>
      {!state.open && <Clock className="sr-only" />}
    </span>
  );
}
