"use client";

import { Info, Minus, Plus, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useViewerRole } from "@/components/viewer";
import { useCart, type CartItem } from "@/features/cart/store";
import { canShop } from "@/lib/roles";
import { cn } from "@/lib/utils";

export function AddToCartButton({
  item,
  disabled,
  compact,
  withQuantity,
}: {
  item: Omit<CartItem, "quantity">;
  disabled?: boolean;
  compact?: boolean;
  withQuantity?: boolean;
}) {
  const router = useRouter();
  const role = useViewerRole();
  const add = useCart((state) => state.add);
  const inCart = useCart((state) => state.items.find((i) => i.productId === item.productId)?.quantity ?? 0);
  const [quantity, setQuantity] = useState(1);
  const remaining = Math.max(item.stock - inCart, 0);

  function handleAdd() {
    if (remaining <= 0) {
      toast.warning("Ya tienes en el carrito todas las unidades disponibles.");
      return;
    }
    const qty = Math.min(quantity, remaining);
    add(item, qty);
    toast.success(`${item.name} agregado`, {
      description: `${item.businessName} · ${qty} ${qty === 1 ? "unidad" : "unidades"}`,
      action: { label: "Ver carrito", onClick: () => router.push("/carrito") },
    });
    setQuantity(1);
  }

  if (!canShop(role)) {
    return compact ? null : (
      <p className="flex items-start gap-2.5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        Las cuentas de {role === "admin" ? "administración" : role === "courier" ? "repartidor" : "vendedor"} no pueden comprar. Usa una cuenta
        de cliente para hacer pedidos.
      </p>
    );
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled}
        aria-label={disabled ? "Agotado" : `Agregar ${item.name} al carrito`}
        className={cn(
          "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        )}
      >
        <Plus className="size-4" />
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {withQuantity && !disabled && (
        <QuantityStepper value={quantity} max={Math.max(remaining, 1)} onChange={setQuantity} />
      )}
      <Button size="lg" className="flex-1" onClick={handleAdd} disabled={disabled}>
        <ShoppingBag />
        {disabled ? "Agotado" : "Agregar al carrito"}
      </Button>
    </div>
  );
}

export function QuantityStepper({
  value,
  max,
  onChange,
  size = "md",
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "size-8" : "size-11";
  return (
    <div className="inline-flex items-center rounded-full border bg-card">
      <button
        type="button"
        className={cn(box, "grid cursor-pointer place-items-center rounded-full hover:bg-muted disabled:opacity-40")}
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label="Quitar uno"
      >
        <Minus className="size-4" />
      </button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={cn(box, "grid cursor-pointer place-items-center rounded-full hover:bg-muted disabled:opacity-40")}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Agregar uno"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
