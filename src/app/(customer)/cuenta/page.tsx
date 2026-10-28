import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/customer/account-settings";
import { requireProfile } from "@/lib/auth";
import { ROLE_PROFILE } from "@/lib/roles";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function AccountPage() {
  const { profile } = await requireProfile(undefined, "/cuenta");
  // Vendedores y admins editan su perfil dentro de su panel.
  if (profile.role !== "customer") redirect(ROLE_PROFILE[profile.role]);
  return (
    <div className="container-page py-8">
      <AccountSettings profile={profile} />
    </div>
  );
}
