import type { Metadata } from "next";
import { HoursEditor } from "@/components/vendor/hours-editor";
import { PageHeader } from "@/components/ui/card";
import { openState } from "@/features/businesses/hours";
import { requireApprovedBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { BusinessClosure, BusinessHour } from "@/types/domain";

export const metadata: Metadata = { title: "Horarios" };

export default async function HoursPage() {
  const { business } = await requireApprovedBusiness("/vendedor/horarios");
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua" }).format(new Date());
  const [{ data: hours }, { data: closures }] = await Promise.all([
    supabase.from("business_hours").select("*").eq("business_id", business.id),
    supabase.from("business_closures").select("*").eq("business_id", business.id).gte("date", today).order("date"),
  ]);
  const state = openState((hours ?? []) as BusinessHour[], (closures ?? []) as BusinessClosure[], business.is_open_override);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Horarios" description="Fuera de horario tu negocio aparece como Cerrado y no recibe pagos. Zona horaria: Managua." />
      <HoursEditor
        hours={(hours ?? []) as BusinessHour[]}
        closures={(closures ?? []) as BusinessClosure[]}
        override={business.is_open_override}
        state={state}
      />
    </div>
  );
}
