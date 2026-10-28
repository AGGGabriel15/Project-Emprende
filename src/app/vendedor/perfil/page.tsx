import type { Metadata } from "next";
import { AccountSettings } from "@/components/customer/account-settings";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function VendorProfilePage() {
  const { profile } = await requireProfile(undefined, "/vendedor/perfil");
  return <AccountSettings profile={profile} />;
}
