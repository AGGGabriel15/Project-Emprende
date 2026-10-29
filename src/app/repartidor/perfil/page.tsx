import type { Metadata } from "next";
import { AccountSettings } from "@/components/customer/account-settings";
import { requireCourier } from "@/lib/auth";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function CourierProfilePage() {
  const { profile } = await requireCourier("/repartidor/perfil");
  return <AccountSettings profile={profile} />;
}
