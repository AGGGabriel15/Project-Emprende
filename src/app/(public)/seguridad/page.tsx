import type { Metadata } from "next";
import { LegalPage, LegalTable } from "@/components/legal-page";
import { SupportContact } from "@/components/legal/support-contact";
import { getLegalSettings } from "@/features/legal/settings";

export const metadata: Metadata = { title: "Seguridad de la plataforma" };
export const revalidate = 3600;

export default async function SecurityPage() {
  const { pinAttempts } = await getLegalSettings();
  return (
    <LegalPage
      title="Seguridad de la plataforma"
      updated="1 de noviembre de 2026"
      intro={
        <p>
          Aplicamos la seguridad informática desde el diseño para prevenir los delitos que sanciona la{" "}
          <strong>Ley N.º 1042, Ley Especial de Ciberdelitos</strong>: el acceso indebido a sistemas y datos, el fraude informático y la
          suplantación de identidad. Estas son las medidas activas en la web y en la app.
        </p>
      }
      sections={[
        [
          "1. Conexión cifrada (HTTPS / SSL)",
          <>
            <p>
              Todo el sitio funciona solo por <strong>HTTPS</strong>, con un certificado SSL/TLS válido que se renueva automáticamente. Si alguien
              entra por HTTP, se le redirige a HTTPS, y el navegador recuerda durante 2 años que solo debe usar conexión cifrada (HSTS).
            </p>
            <p>
              Así nadie en la misma red (por ejemplo, un Wi-Fi público) puede leer ni alterar lo que envías: contraseñas, direcciones o datos del
              pedido. Antes de escribir datos, verifica el candado y que la dirección empiece con <strong>https://</strong>.
            </p>
          </>,
          "https",
        ],
        [
          "2. Pagos con cifrado tokenizado",
          "Los pagos se hacen en Stripe Checkout, una pasarela certificada PCI DSS nivel 1. Escribes tu tarjeta en la página segura de Stripe, que la convierte en un token; el número de tarjeta nunca llega a nuestros servidores y no lo guardamos. El pedido solo se confirma cuando Stripe nos avisa por un mensaje firmado (webhook), así que no se puede falsificar un pago desde el navegador.",
          "pagos",
        ],
        [
          "3. Protección de cuentas",
          <ul key="body" className="list-disc space-y-1 pl-5">
            <li>Las contraseñas se guardan solo como hash (bcrypt) y deben tener al menos 8 caracteres, con letras y números.</li>
            <li>Tras 5 intentos fallidos de inicio de sesión desde la misma conexión, el acceso se bloquea 15 minutos (contra la fuerza bruta).</li>
            <li>La sesión vive en cookies HttpOnly, Secure y SameSite: el código de la página no puede leerla.</li>
            <li>Al cerrar sesión, el servidor invalida el token: una copia robada deja de funcionar al instante.</li>
            <li>El inicio de sesión con Google usa OAuth 2.0 con PKCE.</li>
          </ul>,
          "cuentas",
        ],
        [
          "4. Control de acceso a los datos",
          "Cada consulta pasa por reglas de seguridad a nivel de fila en la base de datos: un cliente solo ve sus pedidos y direcciones, un vendedor solo su negocio y un repartidor solo las entregas que atiende. Los documentos de verificación y las fotos de evidencia están en almacenamiento privado, con enlaces temporales. Las acciones de la administración (aprobaciones, cancelaciones, cambios de contraseña) quedan registradas en una bitácora de auditoría.",
          "acceso",
        ],
        [
          "5. Prevención de fraude",
          <LegalTable key="body"
            head={["Riesgo", "Medida"]}
            rows={[
              ["Pagar menos de lo debido", "El servidor recalcula precios y totales con la base de datos; ignora lo que envía el navegador."],
              ["Entregas que nunca llegaron", `Cada entrega exige el PIN del cliente (máximo ${pinAttempts} intentos), una foto y la ubicación GPS.`],
              ["Producto distinto al publicado", "El negocio fotografía el empaque y el repartidor revisa el paquete antes de recogerlo."],
              ["Vendedores falsos", "Verificación de identidad (cédula y selfie), documentos y visita al local antes de aprobar."],
              ["Inyección de código (SQL o XSS)", "Consultas parametrizadas, escape automático del contenido y una política de seguridad de contenido (CSP)."],
            ]}
          />,
          "fraude",
        ],
        [
          "6. Recomendaciones para ti",
          <ul key="body" className="list-disc space-y-1 pl-5">
            <li>Da tu PIN de entrega solo después de recibir y revisar tu pedido.</li>
            <li>Nunca te pediremos tu contraseña ni los datos de tu tarjeta por WhatsApp, llamada o correo.</li>
            <li>Usa una contraseña que no uses en otros sitios y cierra sesión en equipos compartidos.</li>
          </ul>,
          "recomendaciones",
        ],
        [
          "7. Reportar un incidente",
          <>
            <p>
              Si ves un cobro que no reconoces, un intento de suplantación o cualquier actividad sospechosa, avísanos de inmediato. Los delitos
              informáticos también pueden denunciarse ante la Policía Nacional.
            </p>
            <SupportContact />
          </>,
          "incidentes",
        ],
      ]}
    />
  );
}
