import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CheckoutForm } from "@/components/customer/checkout-form";
import { stripeConfigured } from "@/features/payments/provider";
import { isProfileComplete, requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Address } from "@/types/domain";

export const metadata: Metadata = { title: "Pagar pedido" };

type Params = Promise<{ businessId: string }>;

export default async function CheckoutPage({ params }: { params: Params }) {
  const { businessId } = await params;
  const path = `/checkout/${businessId}`;
  const { profile } = await requireCustomer(path);
  if (!isProfileComplete(profile)) redirect(`/completar-perfil?next=${encodeURIComponent(path)}`);

  const supabase = await createClient();
  const [{ data: business }, { data: addresses }] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, trade_name, slug, status, accepts_delivery, accepts_pickup, address_line, logo_url")
      .eq("id", businessId)
      .maybeSingle(),
    supabase
      .from("addresses")
      .select("*")
      .eq("user_id", profile.id)
      .order("is_default", { ascending: false }),
  ]);
  if (!business || business.status !== "approved") notFound();

  return (
    <div className="container-page py-8">
      <CheckoutForm
        business={business}
        addresses={(addresses ?? []) as Address[]}
        contact={{ name: profile.full_name, phone: profile.phone ?? "" }}
        paymentMode={process.env.PAYMENTS_MODE !== "mock" && stripeConfigured() ? "stripe" : "mock"}
      />
    </div>
  );
}
