import { z } from "zod";
import { failure, invalid, success } from "@/lib/actions";
import type { SupabaseClient } from "@supabase/supabase-js";
import { slugify, toMinor } from "@/lib/format";
import {
  bankStepSchema,
  businessSettingsSchema,
  formalUpgradeSchema,
  legalStepSchema,
  storeStepSchema,
} from "@/lib/validations/business";
import {
  closureSchema,
  hoursSchema,
  productCategorySchema,
  productSchema,
} from "@/lib/validations/catalog";
import type { Business, DocumentType } from "@/types/domain";

/**
 * Acciones del negocio compartidas por las Server Actions del web y la app
 * móvil: reciben el cliente de Supabase y el usuario (RLS protege cada tabla).
 */

/** Sufijo aleatorio corto para slugs (no es un secreto). */
function shortId(length: number) {
  return Array.from({ length }, () => Math.floor(Math.random() * 36).toString(36)).join("");
}

async function contextWith(supabase: SupabaseClient, userId: string) {
  const { data: business } = await supabase.from("businesses").select("*").eq("owner_id", userId).maybeSingle<Business>();
  return { user: { id: userId }, business };
}

async function requireBusinessWith(supabase: SupabaseClient, userId: string) {
  const ctx = await contextWith(supabase, userId);
  if (!ctx.business) throw new Error("No tienes un negocio registrado.");
  return ctx as typeof ctx & { business: Business };
}

function editable(business: Business | null) {
  return !business || business.status === "draft" || business.status === "rejected";
}

// Solicitud ------------------------------------------------------------------

export async function saveLegalStepWith(supabase: SupabaseClient, userId: string, input: unknown) {
  const parsed = legalStepSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { user, business } = await contextWith(supabase, userId);
  if (!user) return failure({ message: "Inicia sesión." });
  if (!editable(business)) return failure({ message: "La solicitud ya fue enviada." });

  const data = parsed.data;
  const row = {
    tier: data.tier,
    trade_name: data.tradeName,
    legal_name: data.legalName,
    person_type: data.tier === "formal" ? data.personType : "natural",
    ruc: data.tier === "formal" ? data.ruc : null,
    tax_regime: data.tier === "formal" ? data.taxRegime : null,
    municipal_license: data.tier === "formal" ? data.municipalLicense : null,
  };
  if (business) {
    const { error } = await supabase.from("businesses").update(row).eq("id", business.id);
    if (error) return failure(error);
    return success({ businessId: business.id });
  }
  const base = slugify(parsed.data.tradeName) || "negocio";
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${shortId(4)}`;
    const { data, error } = await supabase
      .from("businesses")
      .insert({ ...row, owner_id: user.id, slug })
      .select("id")
      .single();
    if (!error) return success({ businessId: data.id as string });
    if (error.code !== "23505" || !error.message.includes("slug")) return failure(error);
  }
  return failure({ message: "No pudimos generar el enlace del negocio." });
}

export async function saveStoreStepWith(supabase: SupabaseClient, userId: string, input: unknown) {
  const parsed = storeStepSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { business } = await contextWith(supabase, userId);
  if (!business) return failure({ message: "Completa primero los datos legales." });
  if (!editable(business)) return failure({ message: "La solicitud ya fue enviada." });
  const { error } = await supabase
    .from("businesses")
    .update({
      category_id: parsed.data.categoryId,
      description: parsed.data.description,
      department_id: parsed.data.departmentId,
      municipality_id: parsed.data.municipalityId,
      address_line: parsed.data.addressLine,
      phone: parsed.data.phone,
      whatsapp: parsed.data.whatsapp || null,
      logo_url: parsed.data.logoUrl || null,
      cover_url: parsed.data.coverUrl || null,
    })
    .eq("id", business.id);
  if (error) return failure(error);
  if (parsed.data.latitude != null && parsed.data.longitude != null) {
    const { error: geoError } = await supabase.from("business_private").upsert({
      business_id: business.id,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      updated_at: new Date().toISOString(),
    });
    if (geoError) return failure(geoError);
  }
  return success();
}

export async function saveBankStepWith(supabase: SupabaseClient, userId: string, input: unknown) {
  const parsed = bankStepSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { business } = await contextWith(supabase, userId);
  if (!business) return failure({ message: "Completa primero los datos legales." });
  const { error } = await supabase.from("business_bank_accounts").upsert({
    business_id: business.id,
    bank_name: parsed.data.bankName,
    account_type: parsed.data.accountType,
    currency: parsed.data.currency,
    account_number: parsed.data.accountNumber,
    account_holder: parsed.data.accountHolder,
    updated_at: new Date().toISOString(),
  });
  if (error) return failure(error);
  return success();
}

const documentSchema = z.object({
  docType: z.enum([
    "ruc",
    "cedula_front",
    "cedula_back",
    "municipal_license",
    "selfie_cedula",
    "place_photo_1",
    "place_photo_2",
    "other",
  ]),
  filePath: z.string().min(3).max(300),
});

export async function recordDocumentWith(supabase: SupabaseClient, userId: string, input: { docType: DocumentType; filePath: string }) {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { user, business } = await contextWith(supabase, userId);
  if (!user || !business) return failure({ message: "Completa primero los datos legales." });
  if (!parsed.data.filePath.startsWith(`${user.id}/`)) return failure({ message: "Ruta de archivo inválida." });
  const { error } = await supabase.from("business_documents").upsert(
    {
      business_id: business.id,
      doc_type: parsed.data.docType,
      file_path: parsed.data.filePath,
      status: "pending",
      created_at: new Date().toISOString(),
    },
    { onConflict: "business_id,doc_type" },
  );
  if (error) return failure(error);
  return success();
}

export async function submitApplicationWith(supabase: SupabaseClient, userId: string, rate: number) {
  const { business } = await contextWith(supabase, userId);
  if (!business) return failure({ message: "Completa la solicitud." });
  const { data: terms } = await supabase.from("platform_settings").select("value").eq("key", "terms_version").maybeSingle();
  const { error: termsError } = await supabase
    .from("businesses")
    .update({
      accepted_terms_at: new Date().toISOString(),
      declaration_accepted_at: new Date().toISOString(),
      accepted_commission_rate: rate,
      accepted_terms_version: String(terms?.value ?? "2026-10"),
    })
    .eq("id", business.id);
  if (termsError) return failure(termsError);
  const { error } = await supabase.rpc("submit_business_application", { p_business: business.id });
  if (error) return failure(error);
  return success();
}

/** Un emprendedor aprobado pide pasar a Negocio formal (el admin lo revisa). */
export async function requestFormalUpgradeWith(supabase: SupabaseClient, userId: string, input: unknown) {
  const parsed = formalUpgradeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { business } = await requireBusinessWith(supabase, userId);
    const { error } = await supabase.rpc("request_formal_upgrade", {
      p_business: business.id,
      p_person_type: parsed.data.personType,
      p_ruc: parsed.data.ruc,
      p_tax_regime: parsed.data.taxRegime,
      p_license: parsed.data.municipalLicense,
    });
    if (error) return failure(error);
    return success();
  } catch (err) {
    return failure(err);
  }
}

// Configuración del negocio --------------------------------------------------

export async function updateBusinessSettingsWith(supabase: SupabaseClient, userId: string, input: unknown) {
  const parsed = businessSettingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { business } = await requireBusinessWith(supabase, userId);
    const { error } = await supabase
      .from("businesses")
      .update({
        trade_name: parsed.data.tradeName,
        category_id: parsed.data.categoryId,
        description: parsed.data.description,
        department_id: parsed.data.departmentId,
        municipality_id: parsed.data.municipalityId,
        address_line: parsed.data.addressLine,
        phone: parsed.data.phone,
        whatsapp: parsed.data.whatsapp || null,
        logo_url: parsed.data.logoUrl || null,
        cover_url: parsed.data.coverUrl || null,
      })
      .eq("id", business.id);
    if (error) return failure(error);
    return success({ slug: business.slug });
  } catch (err) {
    return failure(err);
  }
}

export async function setServicesWith(supabase: SupabaseClient, userId: string, input: { acceptsDelivery: boolean; acceptsPickup: boolean }) {
  if (!input.acceptsDelivery && !input.acceptsPickup) {
    return failure({ message: "Debes ofrecer al menos un tipo de servicio." });
  }
  try {
    const { business } = await requireBusinessWith(supabase, userId);
    const { error } = await supabase
      .from("businesses")
      .update({ accepts_delivery: input.acceptsDelivery, accepts_pickup: input.acceptsPickup })
      .eq("id", business.id);
    if (error) return failure(error);
    return success();
  } catch (err) {
    return failure(err);
  }
}

// Horarios -------------------------------------------------------------------

export async function saveHoursWith(supabase: SupabaseClient, userId: string, input: unknown) {
  const parsed = hoursSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { business } = await requireBusinessWith(supabase, userId);
    const { error } = await supabase.from("business_hours").upsert(
      parsed.data.map((h) => ({
        business_id: business.id,
        day_of_week: h.dayOfWeek,
        opens_at: h.opensAt,
        closes_at: h.closesAt,
        is_closed: h.isClosed,
      })),
    );
    if (error) return failure(error);
    return success();
  } catch (err) {
    return failure(err);
  }
}

export async function setOpenOverrideWith(supabase: SupabaseClient, userId: string, value: boolean | null) {
  try {
    const { business } = await requireBusinessWith(supabase, userId);
    const { error } = await supabase.from("businesses").update({ is_open_override: value }).eq("id", business.id);
    if (error) return failure(error);
    return success();
  } catch (err) {
    return failure(err);
  }
}

export async function addClosureWith(supabase: SupabaseClient, userId: string, input: unknown) {
  const parsed = closureSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { business } = await requireBusinessWith(supabase, userId);
    const { error } = await supabase
      .from("business_closures")
      .upsert({ business_id: business.id, ...parsed.data }, { onConflict: "business_id,date" });
    if (error) return failure(error);
    return success();
  } catch (err) {
    return failure(err);
  }
}

export async function deleteClosureWith(supabase: SupabaseClient, userId: string, id: string) {
  const { error } = await supabase.from("business_closures").delete().eq("id", id);
  if (error) return failure(error);
  return success();
}

// Categorías propias ---------------------------------------------------------

export async function saveProductCategoryWith(supabase: SupabaseClient, userId: string, input: unknown, id?: string) {
  const parsed = productCategorySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { business } = await requireBusinessWith(supabase, userId);
    const query = id
      ? supabase.from("product_categories").update({ name: parsed.data.name }).eq("id", id)
      : supabase.from("product_categories").insert({
          business_id: business.id,
          name: parsed.data.name,
          sort_order: Date.now() % 1_000_000,
        });
    const { error } = await query;
    if (error) return failure(error.code === "23505" ? { message: "Ya tienes una categoría con ese nombre." } : error);
    return success();
  } catch (err) {
    return failure(err);
  }
}

export async function reorderProductCategoriesWith(supabase: SupabaseClient, userId: string, ids: string[]) {
  await Promise.all(
    ids.map((id, index) => supabase.from("product_categories").update({ sort_order: index }).eq("id", id)),
  );
  return success();
}

export async function deleteProductCategoryWith(supabase: SupabaseClient, userId: string, id: string) {
  const { error } = await supabase.from("product_categories").delete().eq("id", id);
  if (error) return failure(error);
  return success();
}

// Productos ------------------------------------------------------------------

export async function saveProductWith(supabase: SupabaseClient, userId: string, input: unknown, id?: string) {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { business } = await requireBusinessWith(supabase, userId);
    const data = parsed.data;
    const row = {
      business_id: business.id,
      category_id: data.categoryId || null,
      name: data.name,
      description: data.description,
      material: data.material || null,
      dimensions: data.dimensions || null,
      weight_grams: data.weightGrams ?? null,
      price_minor: toMinor(data.price),
      stock: data.stock,
      is_active: data.isActive,
      images: data.images,
    };
    if (id) {
      const { error } = await supabase.from("products").update(row).eq("id", id).eq("business_id", business.id);
      if (error) return failure(error);
      return success({ id });
    }
    const base = slugify(data.name) || "producto";
    const { data: created, error } = await supabase
      .from("products")
      .insert({ ...row, slug: `${base}-${shortId(6)}` })
      .select("id")
      .single();
    if (error) return failure(error);
    return success({ id: created.id as string });
  } catch (err) {
    return failure(err);
  }
}

export async function setProductActiveWith(supabase: SupabaseClient, userId: string, id: string, isActive: boolean) {
  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", id);
  if (error) return failure(error);
  return success();
}

export async function updateStockWith(supabase: SupabaseClient, userId: string, id: string, stock: number) {
  if (!Number.isInteger(stock) || stock < 0) return failure({ message: "Stock inválido." });
  const { error } = await supabase.from("products").update({ stock }).eq("id", id);
  if (error) return failure(error);
  return success();
}

export async function deleteProductWith(supabase: SupabaseClient, userId: string, id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return failure(error);
  return success();
}
