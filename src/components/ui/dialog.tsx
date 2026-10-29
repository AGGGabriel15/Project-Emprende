"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
  side,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** "sheet" se muestra como panel inferior en móvil. */
  side?: "center" | "sheet";
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=open]:animate-in" />
      <KeyboardAwareContent title={title} description={description} className={className} side={side}>
        {children}
      </KeyboardAwareContent>
    </DialogPrimitive.Portal>
  );
}

/**
 * Con el teclado del celular abierto el navegador solo achica el área visible
 * (visual viewport), y un panel fijo abajo quedaría tapado. Mientras el teclado
 * está abierto, el modal se acomoda a esa área y lleva el campo enfocado a la vista.
 */
function KeyboardAwareContent({
  title,
  description,
  children,
  className,
  side,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  side?: "center" | "sheet";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const keyboard = useSyncExternalStore(subscribeViewport, keyboardViewport, () => "");
  const [top, height, narrow] = keyboard ? keyboard.split(",").map(Number) : [0, 0, 0];

  useEffect(() => {
    if (!keyboard) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && ref.current?.contains(active)) {
      requestAnimationFrame(() => active.scrollIntoView({ block: "nearest" }));
    }
  }, [keyboard]);

  return (
    <DialogPrimitive.Content
      ref={ref}
      style={
        !keyboard
          ? undefined
          : side === "sheet" && narrow
            ? { top: top + height, bottom: "auto", translate: "0 -100%", maxHeight: height - 8 }
            : { top: top + height / 2, maxHeight: height - 16 }
      }
      className={cn(
        "fixed z-50 max-h-[92dvh] w-full overflow-y-auto border bg-card p-6 shadow-2xl focus:outline-none",
        side === "sheet"
          ? "inset-x-0 bottom-0 rounded-t-3xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
          : "top-1/2 left-1/2 max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl sm:max-w-lg",
        className,
      )}
    >
      <div className="mb-5 pr-8">
        <DialogPrimitive.Title className="font-display text-xl font-semibold">
          {title}
        </DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
            {description}
          </DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">
            {title}
          </DialogPrimitive.Description>
        )}
      </div>
      {children}
      <DialogPrimitive.Close
        className="absolute top-4 right-4 grid size-9 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted"
        aria-label="Cerrar"
      >
        <X className="size-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  );
}

function subscribeViewport(onChange: () => void) {
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", onChange);
  viewport?.addEventListener("scroll", onChange);
  return () => {
    viewport?.removeEventListener("resize", onChange);
    viewport?.removeEventListener("scroll", onChange);
  };
}

/** "top,alto,angosto" del área visible cuando el teclado la reduce; "" si no hay teclado. */
function keyboardViewport() {
  const viewport = window.visualViewport;
  if (!viewport || viewport.scale > 1.01) return "";
  const covered = document.documentElement.clientHeight - viewport.height;
  if (covered <= 120) return "";
  const narrow = window.matchMedia("(max-width: 639px)").matches ? 1 : 0;
  return `${Math.round(viewport.offsetTop)},${Math.round(viewport.height)},${narrow}`;
}
