import { createAdminClient } from "@/lib/supabase/admin";

/**
 * URLs firmadas (10 min) de las fotos de evidencia del bucket privado.
 * Llamar solo después de comprobar que el usuario puede ver el pedido.
 */
export async function signEvidence(paths: (string | null | undefined)[]) {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (!unique.length) return {} as Record<string, string>;
  const { data } = await createAdminClient().storage.from("delivery-evidence").createSignedUrls(unique, 600);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path!, d.signedUrl])) as Record<string, string>;
}
