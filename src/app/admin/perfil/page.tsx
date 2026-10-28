import type { Metadata } from "next";
import { AccountSettings } from "@/components/customer/account-settings";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function AdminProfilePage() {
  const { profile } = await requireProfile(["admin"], "/admin/perfil");
  return <AccountSettings profile={profile} />;
}
