"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalid, success } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { slugify, toMinor } from "@/lib/utils";
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

async function context() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: business } = user
    ? await supabase.from("businesses").select("*").eq("owner_id", user.id).maybeSingle<Business>()
    : { data: null };
  return { supabase, user, business };
}

async function requireBusiness() {
  const ctx = await context();
  if (!ctx.user || !ctx.business) throw new Error("No tienes un negocio registrado.");
  return ctx as typeof ctx & { business: Business; user: NonNullable<typeof ctx.user> };
}

function editable(business: Business | null) {
  return !business || business.status === "draft" || business.status === "rejected";
}

// Solicitud ------------------------------------------------------------------

export async function saveLegalStep(input: unknown) {
  const parsed = legalStepSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user, business } = await context();
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
    const slug = attempt === 0 ? base : `${base}-${crypto.randomUUID().slice(0, 4)}`;
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

export async function saveStoreStep(input: unknown) {
  const parsed = storeStepSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, business } = await context();
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

export async function saveBankStep(input: unknown) {
  const parsed = bankStepSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, business } = await context();
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

export async function recordDocument(input: { docType: DocumentType; filePath: string }) {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user, business } = await context();
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

export async function submitApplication(rate: number) {
  const { supabase, business } = await context();
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
  revalidatePath("/vendedor", "layout");
  return success();
}

/** Un emprendedor aprobado pide pasar a Negocio formal (el admin lo revisa). */
export async function requestFormalUpgrade(input: unknown) {
  const parsed = formalUpgradeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { supabase, business } = await requireBusiness();
    const { error } = await supabase.rpc("request_formal_upgrade", {
      p_business: business.id,
      p_person_type: parsed.data.personType,
      p_ruc: parsed.data.ruc,
      p_tax_regime: parsed.data.taxRegime,
      p_license: parsed.data.municipalLicense,
    });
    if (error) return failure(error);
    revalidatePath("/vendedor", "layout");
    return success();
  } catch (err) {
    return failure(err);
  }
}

// Configuración del negocio --------------------------------------------------

export async function updateBusinessSettings(input: unknown) {
  const parsed = businessSettingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { supabase, business } = await requireBusiness();
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
    revalidatePath("/vendedor", "layout");
    revalidatePath(`/negocios/${business.slug}`);
    return success();
  } catch (err) {
    return failure(err);
  }
}

export async function setServices(input: { acceptsDelivery: boolean; acceptsPickup: boolean }) {
  if (!input.acceptsDelivery && !input.acceptsPickup) {
    return failure({ message: "Debes ofrecer al menos un tipo de servicio." });
  }
  try {
    const { supabase, business } = await requireBusiness();
    const { error } = await supabase
      .from("businesses")
      .update({ accepts_delivery: input.acceptsDelivery, accepts_pickup: input.acceptsPickup })
      .eq("id", business.id);
    if (error) return failure(error);
    revalidatePath("/vendedor/delivery");
    return success();
  } catch (err) {
    return failure(err);
  }
}

// Horarios -------------------------------------------------------------------

export async function saveHours(input: unknown) {
  const parsed = hoursSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { supabase, business } = await requireBusiness();
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
    revalidatePath("/vendedor/horarios");
    return success();
  } catch (err) {
    return failure(err);
  }
}

export async function setOpenOverride(value: boolean | null) {
  try {
    const { supabase, business } = await requireBusiness();
    const { error } = await supabase.from("businesses").update({ is_open_override: value }).eq("id", business.id);
    if (error) return failure(error);
    revalidatePath("/vendedor", "layout");
    return success();
  } catch (err) {
    return failure(err);
  }
}

export async function addClosure(input: unknown) {
  const parsed = closureSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { supabase, business } = await requireBusiness();
    const { error } = await supabase
      .from("business_closures")
      .upsert({ business_id: business.id, ...parsed.data }, { onConflict: "business_id,date" });
    if (error) return failure(error);
    revalidatePath("/vendedor/horarios");
    return success();
  } catch (err) {
    return failure(err);
  }
}

export async function deleteClosure(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("business_closures").delete().eq("id", id);
  if (error) return failure(error);
  revalidatePath("/vendedor/horarios");
  return success();
}

// Categorías propias ---------------------------------------------------------

export async function saveProductCategory(input: unknown, id?: string) {
  const parsed = productCategorySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { supabase, business } = await requireBusiness();
    const query = id
      ? supabase.from("product_categories").update({ name: parsed.data.name }).eq("id", id)
      : supabase.from("product_categories").insert({
          business_id: business.id,
          name: parsed.data.name,
          sort_order: Date.now() % 1_000_000,
        });
    const { error } = await query;
    if (error) return failure(error.code === "23505" ? { message: "Ya tienes una categoría con ese nombre." } : error);
    revalidatePath("/vendedor/categorias");
    return success();
  } catch (err) {
    return failure(err);
  }
}

export async function reorderProductCategories(ids: string[]) {
  const supabase = await createClient();
  await Promise.all(
    ids.map((id, index) => supabase.from("product_categories").update({ sort_order: index }).eq("id", id)),
  );
  revalidatePath("/vendedor/categorias");
  return success();
}

export async function deleteProductCategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("product_categories").delete().eq("id", id);
  if (error) return failure(error);
  revalidatePath("/vendedor/categorias");
  return success();
}

// Productos ------------------------------------------------------------------

export async function saveProduct(input: unknown, id?: string) {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { supabase, business } = await requireBusiness();
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
      revalidatePath("/vendedor/productos");
      revalidatePath(`/productos/${id}`);
      return success({ id });
    }
    const base = slugify(data.name) || "producto";
    const { data: created, error } = await supabase
      .from("products")
      .insert({ ...row, slug: `${base}-${crypto.randomUUID().slice(0, 6)}` })
      .select("id")
      .single();
    if (error) return failure(error);
    revalidatePath("/vendedor/productos");
    return success({ id: created.id as string });
  } catch (err) {
    return failure(err);
  }
}

export async function setProductActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", id);
  if (error) return failure(error);
  revalidatePath("/vendedor/productos");
  return success();
}

export async function updateStock(id: string, stock: number) {
  if (!Number.isInteger(stock) || stock < 0) return failure({ message: "Stock inválido." });
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ stock }).eq("id", id);
  if (error) return failure(error);
  revalidatePath("/vendedor/productos");
  return success();
}

export async function deleteProduct(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return failure(error);
  revalidatePath("/vendedor/productos");
  return success();
}
