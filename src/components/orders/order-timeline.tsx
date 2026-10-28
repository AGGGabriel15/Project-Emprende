import { Check } from "lucide-react";
import { ORDER_STATUS_LABEL, timelineSteps } from "@/features/orders/status";
import { cn, formatDate } from "@/lib/utils";
import type { OrderStatus, OrderStatusHistory, ServiceType } from "@/types/domain";
import { ORDER_STATUS_ICON } from "./order-status-badge";

/** Línea de tiempo del pedido según order_status_history. */
export function OrderTimeline({
  status,
  service,
  history,
}: {
  status: OrderStatus;
  service: ServiceType;
  history: OrderStatusHistory[];
}) {
  const reachedAt = new Map(history.map((h) => [h.to_status, h.created_at]));
  const cancelled = status === "cancelled" || status === "refunded";
  const steps: OrderStatus[] = cancelled
    ? [...timelineSteps(service).filter((s) => reachedAt.has(s)), "cancelled", ...(status === "refunded" ? (["refunded"] as const) : [])]
    : timelineSteps(service);
  const currentIndex = steps.indexOf(status);

  return (
    <ol className="relative space-y-0">
      {steps.map((step, index) => {
        const done = index < currentIndex || (index === currentIndex && (step === "completed" || cancelled));
        const current = index === currentIndex && !done;
        const Icon = ORDER_STATUS_ICON[step];
        const at = reachedAt.get(step);
        const note = history.find((h) => h.to_status === step)?.note;
        const bad = step === "cancelled" || step === "refunded";
        return (
          <li key={step} className="relative flex gap-4 pb-6 last:pb-0">
            {index < steps.length - 1 && (
              <span
                className={cn("absolute top-9 left-[17px] h-[calc(100%-2.25rem)] w-0.5", index < currentIndex ? "bg-primary" : "bg-border")}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-10 grid size-9 shrink-0 place-items-center rounded-full border-2",
                bad && (done || current)
                  ? "border-destructive bg-destructive-soft text-destructive"
                  : done
                    ? "border-primary bg-primary text-primary-foreground"
                    : current
                      ? "border-primary bg-primary-soft text-primary ring-4 ring-primary/15"
                      : "border-border bg-card text-muted-foreground",
              )}
            >
              {done && !bad ? <Check className="size-4" /> : <Icon className="size-4" />}
            </span>
            <div className="pt-1.5">
              <p className={cn("text-sm font-semibold", !done && !current && "text-muted-foreground")}>
                {ORDER_STATUS_LABEL[step]}
                {current && <span className="ml-2 text-xs font-normal text-primary">Estado actual</span>}
              </p>
              {at && <p className="text-xs text-muted-foreground">{formatDate(at)}</p>}
              {note && bad && <p className="mt-1 text-sm">{note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
