"use server";

import { revalidatePath } from "next/cache";
import { failure, invalid, success } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import {
  addressSchema,
  locationSchema,
  profileSchema,
} from "@/lib/validations/profile";
import type { Address } from "@/types/domain";

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
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await currentUser();
  if (!user) return failure({ message: "Inicia sesión." });
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
    .eq("id", user.id);
  if (error) return failure(error);
  revalidatePath("/", "layout");
  return success();
}

/** Guarda (o quita) la foto de perfil y borra la anterior del bucket. */
export async function updateAvatar(url: string | null) {
  const { supabase, user } = await currentUser();
  if (!user) return failure({ message: "Inicia sesión." });
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`;
  if (url !== null && !url.startsWith(`${base}${user.id}/`)) {
    return failure({ message: "Imagen no válida." });
  }
  const { data: current } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).single();
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  if (error) return failure(error);
  const previous = current?.avatar_url;
  if (previous && previous !== url && previous.startsWith(`${base}${user.id}/`)) {
    await supabase.storage.from("avatars").remove([previous.slice(base.length)]);
  }
  revalidatePath("/", "layout");
  return success();
}

export async function saveAddress(input: unknown, id?: string) {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await currentUser();
  if (!user) return failure({ message: "Inicia sesión." });

  const { count } = await supabase
    .from("addresses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const isDefault = parsed.data.isDefault || !count;
  if (isDefault) {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  }
  const row = {
    user_id: user.id,
    label: parsed.data.label,
    department_id: parsed.data.departmentId,
    municipality_id: parsed.data.municipalityId,
    address_line: parsed.data.addressLine,
    recipient_name: parsed.data.recipientName,
    phone: parsed.data.phone,
    is_default: isDefault,
  };
  const query = id
    ? supabase.from("addresses").update(row).eq("id", id).select().single()
    : supabase.from("addresses").insert(row).select().single();
  const { data, error } = await query;
  if (error) return failure(error);
  revalidatePath("/cuenta");
  return success(data as Address);
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
