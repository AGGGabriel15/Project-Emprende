import { cn } from "@/lib/utils";

export type BadgeTone =
  | "green"
  | "amber"
  | "red"
  | "gray"
  | "blue"
  | "violet"
  | "brand";

const tones: Record<BadgeTone, string> = {
  green: "bg-success-soft text-success",
  amber: "bg-warning-soft text-warning",
  red: "bg-destructive-soft text-destructive",
  gray: "bg-muted text-muted-foreground",
  blue: "bg-info-soft text-info",
  violet: "bg-violet-soft text-violet",
  brand: "bg-primary-soft text-primary",
};

export function Badge({
  children,
  tone = "gray",
  className,
  dot,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
