import { BarChart3, Bell, ClipboardCheck, FileText, Percent, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMyBusiness, getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Vender en Catarina Market" };

export default async function SellPage() {
  const [session, business] = await Promise.all([getSession(), getMyBusiness()]);
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "commission_rate").maybeSingle();
  const rate = Number(data?.value ?? 0.08);
  const cta = business
    ? { href: business.status === "approved" ? "/vendedor/panel" : "/vendedor/solicitud", label: business.status === "approved" ? "Ir a mi panel" : "Continuar mi solicitud" }
    : session
      ? { href: "/vendedor/solicitud", label: "Empezar solicitud" }
      : { href: "/registro?next=/vendedor/solicitud", label: "Crear cuenta y empezar" };

  return (
    <>
      <section className="pattern-brand text-hero-foreground">
        <div className="container-page py-14 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Para negocios de Catarina</p>
          <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-semibold sm:text-5xl">Lleva tu vivero o taller a todo Nicaragua</h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Sin mensualidad ni inscripción. Solo pagas {formatPercent(rate)} de comisión cuando vendes; el envío es 100 % tuyo.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        </div>
      </section>
      <div className="container-page py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Store, title: "Tu catálogo, tu marca", text: "Página propia con logo, portada, categorías y fotos de cada producto." },
            { icon: Bell, title: "Pedidos en tiempo real", text: "Te avisamos al instante cuando entra un pedido pagado, con sonido." },
            { icon: Percent, title: "Comisión clara", text: `${formatPercent(rate)} sobre productos. Sin costos fijos ni letra pequeña.` },
            { icon: ClipboardCheck, title: "Horarios y zonas", text: "Define cuándo abres, a qué departamentos envías y cuánto cobras." },
            { icon: BarChart3, title: "Reportes", text: "Ventas, productos más vendidos y liquidaciones exportables a Excel o PDF." },
            { icon: FileText, title: "Con o sin RUC", text: "¿Vendes desde tu casa? Te verificamos con tu cédula, una selfie y una visita. Si tienes RUC y matrícula, entras como Negocio formal." },
          ].map(({ icon: Icon, title, text }) => (
            <Card key={title} className="p-6">
              <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                <Icon className="size-5" />
              </span>
              <h2 className="mt-4 font-sans text-base font-semibold tracking-normal">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </Card>
          ))}
        </div>
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {["Envía la solicitud con tus documentos", "La administración la revisa (te avisamos por correo)", "Publica productos y recibe pedidos"].map((step, i) => (
            <li key={step} className="flex items-center gap-4 rounded-2xl border bg-card p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary font-display text-lg font-semibold text-primary-foreground">{i + 1}</span>
              <span className="font-medium">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
