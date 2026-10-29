import type { SupabaseClient } from "@supabase/supabase-js";
import { failure, invalid, success } from "@/lib/actions";
import { profileSchema } from "@/lib/validations/profile";

/** Perfil del usuario, compartido por las Server Actions del web y la app móvil. */

export async function updateProfileWith(supabase: SupabaseClient, userId: string, input: unknown) {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      cedula: parsed.data.cedula || null,
      department_id: parsed.data.departmentId,
      municipality_id: parsed.data.municipalityId,
      accepted_terms_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) return failure(error);
  return success();
}

/**
 * Guarda (o quita) la foto de perfil y borra la anterior del bucket. Solo
 * acepta imágenes de la carpeta del propio usuario en el bucket público avatars.
 */
export async function setAvatarWith(supabase: SupabaseClient, userId: string, url: string | null) {
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`;
  if (url !== null && !url.startsWith(`${base}${userId}/`)) {
    return failure({ message: "Imagen no válida." });
  }
  const { data: current } = await supabase.from("profiles").select("avatar_url").eq("id", userId).single();
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
  if (error) return failure(error);
  const previous = current?.avatar_url;
  if (previous && previous !== url && previous.startsWith(`${base}${userId}/`)) {
    await supabase.storage.from("avatars").remove([previous.slice(base.length)]);
  }
  return success();
}
