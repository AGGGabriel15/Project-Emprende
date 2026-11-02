import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalTable } from "@/components/legal-page";
import { SupportContact } from "@/components/legal/support-contact";

export const metadata: Metadata = { title: "Aviso de privacidad" };
export const revalidate = 3600;

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Aviso de privacidad"
      updated="1 de noviembre de 2026 · versión 2026-11"
      intro={
        <p>
          Catarina Market trata tus datos personales conforme a la <strong>Ley N.º 787, Ley de Protección de Datos Personales</strong> de
          Nicaragua, y su reglamento. Aquí explicamos qué datos pedimos, cómo los guardamos y con quién se comparten. No compartimos tus datos
          sin tu consentimiento, salvo lo estrictamente necesario para entregar tu pedido.
        </p>
      }
      sections={[
        [
          "1. Consentimiento",
          <>
            <p>
              Al crear tu cuenta marcas la casilla «Acepto los términos y el aviso de privacidad». Si entras con Google, la casilla aparece al
              completar tu perfil. Guardamos la fecha y hora en que diste tu consentimiento.
            </p>
            <p>Puedes revocarlo cuando quieras; como los datos son necesarios para comprar y vender, revocarlo implica cerrar la cuenta.</p>
          </>,
          "consentimiento",
        ],
        [
          "2. Datos que recogemos",
          <ul key="body" className="list-disc space-y-1 pl-5">
            <li>
              <strong>Clientes:</strong> nombre, correo, teléfono, departamento y municipio, direcciones de entrega y, si quieres, cédula y foto de
              perfil.
            </li>
            <li>
              <strong>Vendedores:</strong> además, nombre comercial, RUC y matrícula (si es negocio formal), cédula, selfie con la cédula, fotos y
              ubicación GPS del local, y la cuenta bancaria para las liquidaciones.
            </li>
            <li>
              <strong>Repartidores:</strong> vehículo, placa y la ubicación GPS registrada al recoger y entregar cada pedido.
            </li>
            <li>
              <strong>Pedidos:</strong> productos, montos, fotos de empaque, recogida y entrega, y el PIN de entrega (solo lo ve el cliente).
            </li>
          </ul>,
          "datos",
        ],
        [
          "3. Cómo guardamos tus datos",
          <>
            <LegalTable
              head={["Dato", "Dónde se guarda", "Quién lo ve y cómo se protege"]}
              rows={[
                [
                  "Nombre, correo y teléfono",
                  "Base de datos PostgreSQL (Supabase)",
                  "Tú y la administración. Cifrado en tránsito (HTTPS/TLS) y en reposo (AES-256); reglas de acceso por fila.",
                ],
                ["Contraseña", "Supabase Auth", "Nadie: se guarda solo un hash (bcrypt), nunca la contraseña en texto."],
                [
                  "Datos de tu tarjeta",
                  "Stripe (certificado PCI DSS nivel 1)",
                  "Escribes la tarjeta en la página segura de Stripe; nunca pasa por nuestros servidores. Solo guardamos la referencia del pago y el monto cobrado.",
                ],
                [
                  "Direcciones de entrega",
                  "Base de datos",
                  "Tú. El negocio y el repartidor ven la dirección de un pedido solo mientras lo atienden.",
                ],
                [
                  "Documentos de verificación (cédula, RUC, selfie)",
                  "Almacenamiento privado",
                  "El dueño del negocio y la administración, mediante enlaces temporales.",
                ],
                ["Fotos de evidencia y GPS", "Almacenamiento privado", "Solo las partes del pedido y la administración, con enlaces que vencen a los 10 minutos."],
                ["Cuenta bancaria", "Tabla privada", "El dueño del negocio y la administración, para pagar las liquidaciones."],
              ]}
            />
            <p className="text-sm">
              Los servidores están en Estados Unidos (Supabase y Vercel). Más detalles en{" "}
              <Link href="/seguridad" className="text-primary underline">
                Seguridad de la plataforma
              </Link>
              .
            </p>
          </>,
          "almacenamiento",
        ],
        [
          "4. Para qué los usamos",
          "Para crear tu cuenta, procesar pedidos y pagos, coordinar la entrega, verificar a los vendedores, calcular tarifas de envío, atender reclamos y enviarte avisos de tus pedidos. No los usamos para publicidad de terceros y no los vendemos.",
          "finalidad",
        ],
        [
          "5. Con quién los compartimos",
          <>
            <p>Solo con quien interviene en tu pedido, y solo lo necesario:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>El negocio al que compras: tu nombre, teléfono y la dirección del pedido.</li>
              <li>El repartidor asignado: tu nombre, teléfono y dirección, solo mientras la entrega está en curso.</li>
              <li>Stripe, para cobrar y reembolsar.</li>
              <li>Proveedores de infraestructura (alojamiento, base de datos, correo y notificaciones), con obligación de confidencialidad.</li>
            </ul>
            <p>Fuera de estos casos no compartimos tus datos sin tu consentimiento, salvo orden de autoridad competente.</p>
          </>,
          "compartir",
        ],
        [
          "6. Conservación",
          "Guardamos tus datos mientras tu cuenta esté activa. Al cerrarla, borramos tu perfil y direcciones; conservamos los pedidos y pagos como respaldo contable y para atender reclamos pendientes.",
          "conservacion",
        ],
        [
          "7. Tus derechos",
          <>
            <p>
              Puedes <strong>acceder</strong> a tus datos y <strong>rectificarlos</strong> desde Mi perfil, y pedir su <strong>cancelación</strong>{" "}
              u <strong>oponerte</strong> a un tratamiento escribiendo a soporte; te respondemos por el mismo medio.
            </p>
            <SupportContact />
          </>,
          "derechos",
        ],
      ]}
    />
  );
}
