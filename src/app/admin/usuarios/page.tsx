import type { Metadata } from "next";
import { CreateAdminButton, UserRow } from "@/components/admin/users-table";
import { Card, PageHeader } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/domain";

export const metadata: Metadata = { title: "Usuarios" };

type SearchParams = Promise<{ q?: string }>;

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  const { profile: me } = await requireProfile(["admin"]);
  const supabase = await createClient();
  let query = supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
  if (q) {
    const term = q.replace(/[%,()*\\]/g, " ").trim().slice(0, 60);
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  }
  const { data } = await query;

  return (
    <>
      <PageHeader title="Usuarios" description="Cambia roles o desactiva cuentas. Los administradores solo se crean desde aquí." action={<CreateAdminButton />} />
      <form className="mb-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o correo…"
          className="h-10 w-full max-w-sm rounded-full border bg-card px-4 text-sm focus:border-primary focus:outline-none"
        />
      </form>
      <Card>
        <ul className="divide-y">
          {((data ?? []) as Profile[]).map((user) => (
            <UserRow key={user.id} user={user} isSelf={user.id === me.id} />
          ))}
        </ul>
      </Card>
    </>
  );
}
