"use server";

import { revalidatePath } from "next/cache";
import { failure, invalid, success } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { locationSchema } from "@/lib/validations/profile";
import { saveAddressWith } from "./addresses";
import { setAvatarWith, updateProfileWith } from "./profile";

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function saveProfileLocation(input: unknown) {
  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await currentUser();
  if (!user) return success();
  const { error } = await supabase
    .from("profiles")
    .update({
      department_id: parsed.data.departmentId,
      municipality_id: parsed.data.municipalityId,
    })
    .eq("id", user.id);
  if (error) return failure(error);
  return success();
}

export async function updateProfile(input: unknown) {
  const { supabase, user } = await currentUser();
  if (!user) return failure({ message: "Inicia sesión." });
  const result = await updateProfileWith(supabase, user.id, input);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** Guarda (o quita) la foto de perfil y borra la anterior del bucket. */
export async function updateAvatar(url: string | null) {
  const { supabase, user } = await currentUser();
  if (!user) return failure({ message: "Inicia sesión." });
  const result = await setAvatarWith(supabase, user.id, url);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function saveAddress(input: unknown, id?: string) {
  const { supabase, user } = await currentUser();
  if (!user) return failure({ message: "Inicia sesión." });
  const result = await saveAddressWith(supabase, user.id, input, id);
  if (result.ok) revalidatePath("/cuenta");
  return result;
}

export async function deleteAddress(id: string) {
  const { supabase } = await currentUser();
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  if (error) return failure(error);
  revalidatePath("/cuenta");
  return success();
}

export async function markNotificationsRead() {
  const { supabase, user } = await currentUser();
  if (!user) return success();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  return success();
}
