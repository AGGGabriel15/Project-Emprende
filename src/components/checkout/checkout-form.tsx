"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  FieldError,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui/form-controls";
import { formatMoney } from "@/lib/utils";
import { useCart } from "@/store/cart";
import { checkoutSchema } from "@/validations/checkout";

type CheckoutInput = z.infer<typeof checkoutSchema>;

export function CheckoutForm() {
  const router = useRouter();
  const { data: session } = useSession();
  const items = useCart((state) => state.items);
  const [serverError, setServerError] = useState("");
  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      contactName: session?.user.name ?? "",
      phone: "",
      fulfillmentMethod: "pickup",
      deliveryAddress: "",
    },
  });
  const method = useWatch({ control: form.control, name: "fulfillmentMethod" });
  const total = items.reduce(
    (sum, item) => sum + item.priceMinor * item.quantity,
    0,
  );
  const submit = form.handleSubmit(async (input) => {
    setServerError("");
    const response = await fetch("/api/pagos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...input,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setServerError(body.error?.message ?? "No pudimos iniciar el pago.");
      return;
    }
    router.push(body.data.checkoutUrl);
  });
  if (!items.length)
    return (
      <p className="rounded-2xl border bg-white p-8 text-center">
        Tu carrito está vacío.
      </p>
    );
  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section className="space-y-6 rounded-[2rem] border bg-white p-7 sm:p-9">
        <div>
          <h2 className="text-2xl font-bold">Datos de contacto</h2>
          <p className="mt-1 text-sm text-[#65736b]">
            El emprendedor usará estos datos para coordinar contigo.
          </p>
        </div>
        <div>
          <Label htmlFor="contactName">Nombre de quien recibe</Label>
          <Input id="contactName" {...form.register("contactName")} />
          <FieldError>{form.formState.errors.contactName?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" inputMode="tel" {...form.register("phone")} />
          <FieldError>{form.formState.errors.phone?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="fulfillmentMethod">¿Cómo recibirás tu pedido?</Label>
          <Select
            id="fulfillmentMethod"
            {...form.register("fulfillmentMethod")}
          >
            <option value="pickup">Retiro con el emprendedor</option>
            <option value="delivery">Entrega local</option>
          </Select>
        </div>
        {method === "delivery" && (
          <div>
            <Label htmlFor="deliveryAddress">Dirección de entrega</Label>
            <Textarea
              id="deliveryAddress"
              placeholder="Barrio, calle, referencia..."
              {...form.register("deliveryAddress")}
            />
            <FieldError>
              {form.formState.errors.deliveryAddress?.message}
            </FieldError>
          </div>
        )}
        {serverError && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {serverError}
          </p>
        )}
      </section>
      <aside className="h-fit rounded-[2rem] bg-[#f3eddd] p-7 lg:sticky lg:top-28">
        <h2 className="text-2xl font-bold">Tu pedido</h2>
        <div className="my-5 space-y-3 border-y py-5">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex justify-between gap-3 text-sm"
            >
              <span>
                {item.quantity} × {item.name}
              </span>
              <strong>{formatMoney(item.quantity * item.priceMinor)}</strong>
            </div>
          ))}
        </div>
        <div className="flex items-end justify-between">
          <span>Total</span>
          <strong className="font-serif text-3xl">{formatMoney(total)}</strong>
        </div>
        <Button
          type="submit"
          className="mt-6 w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Preparando pago..." : "Ir a pagar"}
        </Button>
        <p className="mt-3 text-center text-xs text-[#65736b]">
          El total será verificado nuevamente en el servidor.
        </p>
      </aside>
    </form>
  );
}
