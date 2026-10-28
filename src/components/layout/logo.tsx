import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn("flex shrink-0 items-center gap-2.5", className)}
      aria-label="Catarina Market, inicio"
    >
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M6 9h12l-1.2 9.2A2 2 0 0 1 14.8 20H9.2a2 2 0 0 1-2-1.8L6 9Z" />
          <path d="M5 9h14M9 9c0-2.5 1.3-5 3-5s3 2.5 3 5" />
          <path d="M9.5 14c1.5 1 3.5 1 5 0" />
        </svg>
      </span>
      <span className="leading-none">
        <span className="block font-display text-lg font-semibold">Catarina</span>
        <span className="block text-[10px] font-semibold tracking-[0.2em] text-primary uppercase">
          Market
        </span>
      </span>
    </Link>
  );
}
