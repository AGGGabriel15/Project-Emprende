import { redirect } from "next/navigation";
import { getMyBusiness } from "@/lib/auth";

export default async function VendorIndex() {
  const business = await getMyBusiness();
  redirect(business && ["approved", "suspended"].includes(business.status) ? "/vendedor/panel" : "/vendedor/solicitud");
}
