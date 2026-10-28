import { createClient as createSupabase } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import type { Department, Municipality } from "@/types/domain";

export type Geo = { departments: Department[]; municipalities: Municipality[] };

/** Departamentos y municipios (cambian casi nunca: caché de un día). */
export const getGeo = unstable_cache(
  async (): Promise<Geo> => {
    const supabase = createSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const [departments, municipalities] = await Promise.all([
      supabase.from("departments").select("id, name").order("name"),
      supabase.from("municipalities").select("id, department_id, name").order("name"),
    ]);
    return {
      departments: (departments.data ?? []) as Department[],
      municipalities: (municipalities.data ?? []) as Municipality[],
    };
  },
  ["geo-v1"],
  { revalidate: 86_400 },
);

/** Ubicación elegida por el visitante (cookie escrita por useLocation). */
export async function getVisitorLocation() {
  const raw = (await cookies()).get("cm_loc")?.value;
  const [departmentId, municipalityId] = (raw ?? "").split(":").map(Number);
  if (!departmentId || !municipalityId) return null;
  return { departmentId, municipalityId };
}

export function placeName(geo: Geo, municipalityId: number | null | undefined) {
  const municipality = geo.municipalities.find((m) => m.id === municipalityId);
  if (!municipality) return null;
  const department = geo.departments.find((d) => d.id === municipality.department_id);
  return department && department.name !== municipality.name
    ? `${municipality.name}, ${department.name}`
    : municipality.name;
}
