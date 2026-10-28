import type { Metadata } from "next";
import { DeliveryEditor } from "@/components/vendor/delivery-editor";
import { PageHeader } from "@/components/ui/card";
import { requireApprovedBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DeliveryZone } from "@/types/domain";

export const metadata: Metadata = { title: "Delivery" };

export default async function DeliveryPage() {
  const { business } = await requireApprovedBusiness("/vendedor/delivery");
  const supabase = await createClient();
  const { data: zones } = await supabase
    .from("delivery_zones")
    .select("*")
    .eq("business_id", business.id)
    .order("department_id");
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Servicios y delivery"
        description="Si la dirección del cliente no tiene tarifa, el checkout bloquea Delivery y ofrece Para llevar."
      />
      <DeliveryEditor
        acceptsDelivery={business.accepts_delivery}
        acceptsPickup={business.accepts_pickup}
        zones={(zones ?? []) as DeliveryZone[]}
      />
    </div>
  );
}
