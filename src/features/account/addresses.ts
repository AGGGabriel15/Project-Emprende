import type { SupabaseClient } from "@supabase/supabase-js";
import { failure, invalid, success } from "@/lib/actions";
import { addressSchema } from "@/lib/validations/profile";
import type { Address } from "@/types/domain";

/**
 * Direcciones de entrega, compartido por la Server Action del web y la app
 * móvil (recibe el cliente del usuario; RLS limita a sus propias direcciones).
 */
export async function saveAddressWith(supabase: SupabaseClient, userId: string, input: unknown, id?: string) {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const { count } = await supabase
    .from("addresses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  const isDefault = parsed.data.isDefault || !count;
  if (isDefault) {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId);
  }
  const row = {
    user_id: userId,
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
  return success(data as Address);
}
