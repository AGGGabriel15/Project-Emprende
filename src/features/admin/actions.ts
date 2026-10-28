"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalid, success } from "@/lib/actions";
import { button, escape, sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

async function ownerEmail(businessId: string) {
  const { data } = await createAdminClient()
    .from("businesses")
    .select("trade_name, owner:profiles!businesses_owner_id_fkey(email, full_name)")
    .eq("id", businessId)
    .single();
  return data as unknown as { trade_name: string; owner: { email: string | null; full_name: string } | null } | null;
}

const reviewSchema = z.object({
  businessId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().max(500).optional(),
});

export async function reviewApplication(input: unknown) {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { businessId, decision, reason } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_business_application", {
    p_business: businessId,
    p_decision: decision,
    p_reason: reason ?? null,
  });
  if (error) return failure(error);

  const info = await ownerEmail(businessId);
  if (info?.owner?.email) {
    await sendEmail(
      info.owner.email,
      decision === "approved" ? `¡${info.trade_name} fue aprobado!` : "Tu solicitud necesita cambios",
      decision === "approved"
        ? `<p>Hola ${escape(info.owner.full_name)}, tu negocio ya está publicado en Catarina Market. Configura tus horarios, zonas de delivery y productos.</p>${button("/vendedor/panel", "Ir a mi panel")}`
        : `<p>Hola ${escape(info.owner.full_name)}, revisamos tu solicitud y necesitamos que corrijas lo siguiente:</p><p style="background:#fbeee9;padding:12px;border-radius:8px">${escape(reason ?? "")}</p>${button("/vendedor/solicitud", "Corregir y reenviar")}`,
    );
  }
  revalidatePath("/admin", "layout");
  return success();
}

export async function setBusinessSuspended(businessId: string, suspended: boolean, reason?: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_business_suspended", {
    p_business: businessId,
    p_suspended: suspended,
    p_reason: reason ?? null,
  });
  if (error) return failure(error);
  revalidatePath("/admin/negocios");
  return success();
}

/** URL firmada (10 min) para ver un documento privado. */
export async function documentUrl(path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("business-documents").createSignedUrl(path, 600);
  if (error || !data) return failure(error, "No pudimos abrir el documento.");
  return success(data.signedUrl);
}

const userSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["customer", "vendor", "admin"]),
  active: z.boolean(),
});

export async function updateUser(input: unknown) {
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_user", {
    p_user: parsed.data.userId,
    p_role: parsed.data.role,
    p_active: parsed.data.active,
  });
  if (error) return failure(error);
  revalidatePath("/admin/usuarios");
  return success();
}

const createAdminSchema = z.object({
  email: z.string().trim().email(),
  fullName: z.string().trim().min(2),
  password: z.string().min(8),
});

/** Los admins solo los crea otro admin (nunca auto-registro). */
export async function createAdminUser(input: unknown) {
  const parsed = createAdminSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return failure({ message: "Solo administradores." });
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (error) return failure(error);
  await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  await supabase.rpc("admin_log", {
    p_action: "user.create_admin",
    p_entity: "profile",
    p_entity_id: data.user.id,
    p_details: { email: parsed.data.email },
  });
  revalidatePath("/admin/usuarios");
  return success();
}

export async function setSetting(key: string, value: unknown) {
  const allowed = ["commission_rate", "pending_payment_minutes", "support_email", "support_whatsapp"];
  if (!allowed.includes(key)) return failure({ message: "Parámetro desconocido." });
  if (key === "commission_rate" && !(typeof value === "number" && value >= 0 && value < 0.5)) {
    return failure({ message: "La comisión debe estar entre 0 % y 50 %." });
  }
  if (key === "pending_payment_minutes" && !(typeof value === "number" && value >= 30 && value <= 1440)) {
    return failure({ message: "Entre 30 y 1440 minutos (Stripe exige al menos 30)." });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_setting", { p_key: key, p_value: value });
  if (error) return failure(error);
  revalidatePath("/admin", "layout");
  return success();
}

const ruleSchema = z
  .object({
    businessId: z.string().uuid().optional().or(z.literal("")),
    categoryId: z.coerce.number().int().optional(),
    ratePercent: z.coerce.number().min(0).max(50),
    validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
    note: z.string().trim().max(200).optional(),
  })
  .refine((d) => Boolean(d.businessId) !== Boolean(d.categoryId), { message: "Elige un negocio o una categoría." });

export async function saveCommissionRule(input: unknown) {
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const d = parsed.data;
  const { data, error } = await supabase
    .from("commission_rules")
    .insert({
      business_id: d.businessId || null,
      category_id: d.businessId ? null : d.categoryId,
      rate: d.ratePercent / 100,
      valid_from: d.validFrom,
      valid_to: d.validTo || null,
      note: d.note || null,
    })
    .select("id")
    .single();
  if (error) return failure(error);
  await supabase.rpc("admin_log", { p_action: "commission.rule_create", p_entity: "commission_rule", p_entity_id: data.id, p_details: d });
  revalidatePath("/admin/comisiones");
  return success();
}

export async function deleteCommissionRule(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("commission_rules").delete().eq("id", id);
  if (error) return failure(error);
  await supabase.rpc("admin_log", { p_action: "commission.rule_delete", p_entity: "commission_rule", p_entity_id: id, p_details: {} });
  revalidatePath("/admin/comisiones");
  return success();
}

export async function generatePayouts(start: string, end: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_payouts", { p_start: start, p_end: end });
  if (error) return failure(error);
  revalidatePath("/admin/pagos-negocios");
  return success(data as number);
}

export async function markPayoutPaid(id: string, reference: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_payout_paid", { p_payout: id, p_reference: reference });
  if (error) return failure(error);
  revalidatePath("/admin/pagos-negocios");
  return success();
}

const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  icon: z.string().trim().min(2).max(30),
  isActive: z.boolean(),
});

export async function savePlatformCategory(input: unknown, id?: number) {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const row = { name: parsed.data.name, icon: parsed.data.icon, is_active: parsed.data.isActive };
  const { error } = id
    ? await supabase.from("platform_categories").update(row).eq("id", id)
    : await supabase.from("platform_categories").insert({ ...row, slug: slugify(parsed.data.name), sort_order: 99 });
  if (error) return failure(error);
  await supabase.rpc("admin_log", { p_action: id ? "category.update" : "category.create", p_entity: "platform_category", p_entity_id: id ? String(id) : null, p_details: row });
  revalidatePath("/admin/categorias");
  return success();
}

export async function deleteZoneAsAdmin(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
  if (error) return failure(error);
  await supabase.rpc("admin_log", { p_action: "zone.delete", p_entity: "delivery_zone", p_entity_id: id, p_details: {} });
  revalidatePath("/admin/zonas");
  return success();
}
