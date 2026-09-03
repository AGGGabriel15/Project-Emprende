import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { authOptions } from "@/lib/auth";

export default async function CheckoutPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=%2Fcheckout");
  if (session.user.role !== "cliente") redirect("/");
  return (
    <div className="container-page py-12">
      <p className="text-sm font-bold tracking-widest text-[#c87724] uppercase">
        Último paso
      </p>
      <h1 className="mt-2 mb-9 text-5xl font-bold">Finaliza tu compra</h1>
      <CheckoutForm />
    </div>
  );
}
