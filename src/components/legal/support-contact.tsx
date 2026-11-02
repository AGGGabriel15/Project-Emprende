import { getLegalSettings } from "@/features/legal/settings";
import { formatPhone, whatsappHref } from "@/lib/phone";

/** Canales de soporte configurados por la administración. */
export async function SupportContact() {
  const { supportEmail, supportWhatsapp } = await getLegalSettings();
  // Un correo .local es de pruebas y no recibe mensajes.
  const email = supportEmail && !supportEmail.endsWith(".local") ? supportEmail : null;
  if (!email && !supportWhatsapp) return null;
  return (
    <p className="rounded-xl bg-muted px-4 py-3 text-sm text-foreground">
      Soporte de Catarina Market:{" "}
      {supportWhatsapp && (
        <a href={whatsappHref(supportWhatsapp)} target="_blank" rel="noreferrer" className="font-medium text-primary underline">
          WhatsApp {formatPhone(supportWhatsapp)}
        </a>
      )}
      {supportWhatsapp && email && " · "}
      {email && (
        <a href={`mailto:${email}`} className="font-medium text-primary underline">
          {email}
        </a>
      )}
    </p>
  );
}
