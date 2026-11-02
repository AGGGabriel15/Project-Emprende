import { createClient } from "@supabase/supabase-js";
import { cache } from "react";

/**
 * Datos reales que citan las páginas legales (plazos, tarifas, zonas y contacto),
 * leídos de platform_settings para que lo publicado coincida con lo que aplica el
 * sistema. Son datos públicos: basta la clave anónima, sin cookies, para que las
 * páginas sigan siendo estáticas (se regeneran cada hora).
 */
export const getLegalSettings = cache(async () => {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const [{ data: settings }, { data: zones }] = await Promise.all([
    supabase.from("platform_settings").select("key, value"),
    supabase
      .from("platform_delivery_zones")
      .select("fee_minor, estimated_days, department:departments(name), municipality:municipalities(name)")
      .eq("is_active", true),
  ]);
  const value = new Map((settings ?? []).map((s) => [s.key as string, s.value as unknown]));
  const num = (key: string, fallback: number) => Number(value.get(key) ?? fallback);
  type Zone = { fee_minor: number; estimated_days: number; department: { name: string } | null; municipality: { name: string } | null };
  return {
    supportEmail: String(value.get("support_email") ?? ""),
    supportWhatsapp: String(value.get("support_whatsapp") ?? ""),
    serviceFeeMinor: num("service_fee_minor", 1500),
    payMinutes: num("pending_payment_minutes", 30),
    readyHours: num("ready_sla_hours", 24),
    pickupDays: num("pickup_window_days", 7),
    claimHours: num("claim_window_hours", 48),
    deliveryAttempts: num("max_delivery_attempts", 2),
    pinAttempts: num("pin_max_attempts", 5),
    zones: ((zones ?? []) as unknown as Zone[])
      .map((z) => ({
        place: z.municipality ? `${z.municipality.name}, ${z.department?.name ?? ""}` : `${z.department?.name ?? ""} (todo el departamento)`,
        feeMinor: z.fee_minor,
        days: z.estimated_days,
      }))
      .sort((a, b) => a.days - b.days || a.feeMinor - b.feeMinor),
  };
});

export function deliveryTime(days: number) {
  if (days <= 0) return "El mismo día";
  return days === 1 ? "1 día hábil" : `${days} días hábiles`;
}
