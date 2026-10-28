"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Bike,
  CreditCard,
  Lock,
  Plus,
  ShoppingBag,
  Store,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ProductImage } from "@/components/catalog/product-image";
import { useCartHydrated } from "@/components/layout/cart-button";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState, Skeleton } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { PhoneInput } from "@/components/ui/masked-inputs";
import { useCart } from "@/features/cart/store";
import { placeOrder, quoteCheckout } from "@/features/checkout/actions";
import { cn, formatMoney } from "@/lib/utils";
import type { Address, ServiceType } from "@/types/domain";
import { AddressForm } from "./address-form";
import { AddressSummary } from "./address-book";

type CheckoutBusiness = {
  id: string;
  trade_name: string;
  slug: string;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  address_line: string | null;
};

export function CheckoutForm({
  business,
  addresses: initialAddresses,
  contact,
  paymentMode,
}: {
  business: CheckoutBusiness;
  addresses: Address[];
  contact: { name: string; phone: string };
  paymentMode: "stripe" | "mock";
}) {
  const router = useRouter();
  const hydrated = useCartHydrated();
  const allItems = useCart((state) => state.items);
  const items = allItems.filter((item) => item.businessId === business.id);

  const [addresses, setAddresses] = useState(initialAddresses);
  const [service, setService] = useState<ServiceType>(business.accepts_pickup ? "pickup" : "delivery");
  const [addressId, setAddressId] = useState<string | undefined>(initialAddresses[0]?.id);
  const [contactName, setContactName] = useState(contact.name);
  const [contactPhone, setContactPhone] = useState(contact.phone);
  const [note, setNote] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);
  const [paying, startPaying] = useTransition();

  const lines = items.map((i) => ({ productId: i.productId, quantity: i.quantity, note: i.note }));
  const quote = useQuery({
    queryKey: ["quote", business.id, service, addressId, lines],
    enabled: hydrated && items.length > 0,
    queryFn: async () => {
      const result = await quoteCheckout(
        { businessId: business.id, serviceType: service, addressId, items: lines },
        Object.fromEntries(items.map((i) => [i.productId, i.priceMinor])),
      );
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  if (!hydrated) return <Skeleton className="h-96" />;
  if (!items.length) {
    return (
      <EmptyState
        icon={<ShoppingBag />}
        title={`No tienes productos de ${business.trade_name}`}
        action={
          <Button asChild>
            <Link href="/carrito">Volver al carrito</Link>
          </Button>
        }
      />
    );
  }

  const data = quote.data;
  const blocking =
    !data ||
    !data.open ||
    data.lines.some((l) => !l.available) ||
    (service === "delivery" && (!addressId || !data.canDeliver));

  function pay() {
    startPaying(async () => {
      const result = await placeOrder({
        businessId: business.id,
        serviceType: service,
        addressId: service === "delivery" ? addressId : undefined,
        items: lines,
        contactName,
        contactPhone,
        note: note || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        void quote.refetch();
        return;
      }
      // El pedido ya existe (Pendientes): se quita del carrito.
      useCart.getState().clearBusiness(business.id);
      if (result.data.url.startsWith("http")) window.location.assign(result.data.url);
      else router.push(result.data.url);
    });
  }

  return (
    <div>
      <Link href="/carrito" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" /> Volver al carrito
      </Link>
      <h1 className="text-2xl font-semibold sm:text-3xl">Pagar pedido a {business.trade_name}</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="1. ¿Cómo lo recibes?" />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <ServiceOption
                active={service === "pickup"}
                disabled={!business.accepts_pickup}
                onClick={() => setService("pickup")}
                icon={<Store />}
                title="Para llevar"
                text={business.accepts_pickup ? "Retiras en el local. Sin costo de envío." : "Este negocio no ofrece retiro."}
              />
              <ServiceOption
                active={service === "delivery"}
                disabled={!business.accepts_delivery}
                onClick={() => setService("delivery")}
                icon={<Bike />}
                title="Delivery"
                text={business.accepts_delivery ? "El negocio lo envía a tu dirección." : "Este negocio no hace envíos."}
              />
            </CardBody>
          </Card>

          {service === "delivery" ? (
            <Card>
              <CardHeader
                title="2. Dirección de entrega"
                action={
                  <Button variant="outline" size="sm" onClick={() => setAddingAddress(true)}>
                    <Plus /> Nueva
                  </Button>
                }
              />
              <CardBody>
                {addresses.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setAddingAddress(true)}
                    className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                  >
                    <Plus className="size-5" /> Agrega tu dirección de entrega
                  </button>
                ) : (
                  <div className="grid gap-3" role="radiogroup" aria-label="Dirección de entrega">
                    {addresses.map((address) => (
                      <label
                        key={address.id}
                        className={cn(
                          "flex cursor-pointer gap-3 rounded-2xl border p-4 transition",
                          addressId === address.id ? "border-primary bg-primary-soft/40 ring-1 ring-primary" : "hover:border-primary/50",
                        )}
                      >
                        <input
                          type="radio"
                          name="address"
                          className="mt-1 accent-[var(--primary)]"
                          checked={addressId === address.id}
                          onChange={() => setAddressId(address.id)}
                        />
                        <div>
                          <p className="font-medium">{address.label}</p>
                          <AddressSummary address={address} />
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {data && addressId && !data.canDeliver && (
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                    {business.trade_name} no envía a esta dirección.
                    {business.accepts_pickup && (
                      <button type="button" className="cursor-pointer font-semibold text-primary underline" onClick={() => setService("pickup")}>
                        Cambiar a Para llevar
                      </button>
                    )}
                  </p>
                )}
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader title="2. Retiro en el local" />
              <CardBody className="text-sm text-muted-foreground">
                {business.address_line ?? "El negocio te confirmará la dirección."} Te avisaremos cuando esté{" "}
                <strong className="text-foreground">Listo para retirar</strong>.
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="3. Datos de contacto" description="El negocio los usará para coordinar contigo." />
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" htmlFor="contact-name">
                  <Input id="contact-name" value={contactName} onChange={(e) => setContactName(e.target.value)} autoComplete="name" />
                </Field>
                <Field label="Teléfono" htmlFor="contact-phone">
                  <PhoneInput id="contact-phone" value={contactPhone} onChange={setContactPhone} />
                </Field>
              </div>
              <Field label="Nota para el negocio (opcional)" htmlFor="note">
                <Textarea id="note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: es para regalo, llamar antes de llegar…" />
              </Field>
            </CardBody>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader title="Resumen" />
            <CardBody className="space-y-4">
              {quote.isLoading || !data ? (
                <div className="space-y-3">
                  <Skeleton className="h-14" />
                  <Skeleton className="h-14" />
                  <Skeleton className="h-24" />
                </div>
              ) : (
                <>
                  <ul className="space-y-3">
                    {data.lines.map((line) => (
                      <li key={line.productId} className="flex gap-3">
                        <ProductImage src={line.image} alt="" className="size-12 shrink-0 rounded-lg" sizes="48px" />
                        <div className="min-w-0 flex-1 text-sm">
                          <p className={cn("line-clamp-1 font-medium", !line.available && "text-muted-foreground line-through")}>{line.name}</p>
                          <p className="text-muted-foreground">
                            {line.quantity} × {formatMoney(line.unitPrice)}
                          </p>
                          {line.issue && <p className="text-xs font-medium text-destructive">{line.issue}</p>}
                          {line.priceChanged && <p className="text-xs font-medium text-warning">Precio actualizado</p>}
                        </div>
                        <p className="text-sm font-medium tabular-nums">{formatMoney(line.unitPrice * line.quantity)}</p>
                      </li>
                    ))}
                  </ul>
                  <dl className="space-y-2 border-t pt-4 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Subtotal</dt>
                      <dd className="tabular-nums">{formatMoney(data.subtotal)}</dd>
                    </div>
                    {service === "delivery" && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">
                          Delivery
                          {data.estimatedDays !== null && (
                            <span className="block text-xs">
                              Llega en {data.estimatedDays === 0 ? "el mismo día" : `${data.estimatedDays} ${data.estimatedDays === 1 ? "día" : "días"}`}
                            </span>
                          )}
                        </dt>
                        <dd className="tabular-nums">{addressId && data.canDeliver ? formatMoney(data.deliveryFee) : "—"}</dd>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-3 text-base font-semibold">
                      <dt>Total</dt>
                      <dd className="tabular-nums">{formatMoney(data.total)}</dd>
                    </div>
                  </dl>
                  {data.issues.length > 0 && (
                    <ul className="space-y-1.5 rounded-xl bg-warning-soft p-3 text-sm">
                      {data.issues.map((issue) => (
                        <li key={issue} className="flex gap-2">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                          {issue}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {quote.isError && <p className="text-sm text-destructive">{quote.error.message}</p>}
              <Button size="lg" className="w-full" onClick={pay} disabled={blocking} loading={paying}>
                <CreditCard /> {data ? `Pagar ${formatMoney(data.total)}` : "Pagar"}
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <Lock className="size-3.5" />
                {paymentMode === "stripe" ? "Pago seguro con Stripe (modo de prueba)" : "Pago de demostración: no se cobra dinero real"}
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>

      <Dialog open={addingAddress} onOpenChange={setAddingAddress}>
        {addingAddress && (
          <DialogContent side="sheet" title="Nueva dirección">
            <AddressForm
              defaults={{ recipientName: contactName, phone: contactPhone }}
              onSaved={(address) => {
                setAddresses((current) => [address, ...current]);
                setAddressId(address.id);
                setAddingAddress(false);
              }}
            />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function ServiceOption({
  active,
  disabled,
  onClick,
  icon,
  title,
  text,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
        active ? "border-primary bg-primary-soft/40 ring-1 ring-primary" : "hover:border-primary/50",
      )}
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl [&_svg]:size-5", active ? "bg-primary text-primary-foreground" : "bg-muted")}>
        {icon}
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="text-sm text-muted-foreground">{text}</span>
      </span>
    </button>
  );
}
