import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { SupportContact } from "@/components/legal/support-contact";

export const metadata: Metadata = { title: "Términos y condiciones" };
export const revalidate = 3600;

export default function TermsPage() {
  return (
    <LegalPage
      title="Términos y condiciones"
      updated="1 de noviembre de 2026 · versión 2026-11"
      intro={
        <p>
          Al usar Catarina Market aceptas estas condiciones. Respetan los derechos que te reconoce la{" "}
          <strong>Ley N.º 842, Ley de Protección de los Derechos de las Personas Consumidoras y Usuarias</strong>. Los plazos y montos de
          entregas, reembolsos y garantías están en{" "}
          <Link href="/politicas" className="text-primary underline">
            Entregas, reembolsos y garantías
          </Link>
          .
        </p>
      }
      sections={[
        ["1. Qué es Catarina Market", "Plataforma que conecta a clientes con negocios de Catarina, Masaya. Cada negocio es responsable de sus productos, precios y existencias. Catarina Market cobra el pago, lo retiene hasta confirmar la entrega, entrega los pedidos con sus propios repartidores y cobra una comisión al negocio y una tarifa de servicio al cliente."],
        ["2. Pedidos y pagos", "Cada pedido pertenece a un solo negocio y se paga por adelantado en línea. El total incluye los productos, el envío (si aplica) y la tarifa de servicio. El pedido se confirma únicamente cuando la pasarela acredita el cobro; los pedidos sin pago confirmado se cancelan automáticamente."],
        ["3. Precios e información", "Los precios están en córdobas y los fija cada negocio. Antes de pagar ves el desglose: productos, envío y tarifa de servicio. Se cobra exactamente ese total: el servidor recalcula los precios con los publicados y no acepta montos enviados desde el navegador. Cada producto muestra fotos, descripción, material y existencias.", "precios"],
        ["4. Pago protegido", "El dinero queda retenido por Catarina Market. Se libera al negocio 48 horas después de la entrega si el cliente no reporta problemas. Los emprendedores verificados con pocos pedidos esperan 7 días adicionales."],
        ["5. Preparación", "El negocio debe empacar el pedido y marcarlo como listo con una foto dentro del plazo indicado (24 horas por defecto). Si no lo hace, el pedido se cancela, el cliente recibe el reembolso total y el negocio recibe una falta."],
        ["6. Delivery y retiro", "El delivery lo realizan repartidores de Catarina Market según las zonas y tarifas publicadas. El repartidor ve los datos de contacto del cliente solo mientras la entrega está en curso, compara el paquete con la foto del negocio y puede rechazarlo si no coincide o viene dañado. Cada pedido tiene un PIN de 4 dígitos que solo ve el cliente: la entrega (a domicilio o en el local del negocio) se confirma únicamente con ese PIN. El cliente debe darlo solo después de recibir y revisar su pedido."],
        ["7. Entregas fallidas y retiros vencidos", "Tras 2 intentos de entrega fallidos por ausencia del cliente o dirección incorrecta, el pedido vuelve al negocio y se reembolsan los productos, no el envío ni la tarifa de servicio. Si el cliente no retira un pedido en el local en 7 días, se cancela y se reembolsa todo menos la tarifa de servicio."],
        ["8. Reclamos", <>
          <p>El cliente puede reportar un problema hasta 48 horas después de la entrega, con fotos cuando el producto llegó dañado, incompleto o distinto. La administración decide con la evidencia de cada paso (foto del negocio, foto de recolección, PIN y foto de entrega). Si la responsabilidad es del negocio, el reembolso se descuenta de su liquidación; si es del repartidor o de la plataforma, lo asume Catarina Market. El cliente puede calificar al repartidor después de cada entrega. Un reclamo de &quot;no recibido&quot; sobre un pedido entregado con PIN se rechaza salvo evidencia en contrario.</p>
          <p>
            Si no estás de acuerdo con la resolución, puedes acudir a la Dirección de Defensa del Consumidor del MIFIC. Los pasos están en{" "}
            <Link href="/politicas#reclamos" className="text-primary underline">Cómo hacer un reclamo</Link>.
          </p>
          <SupportContact />
        </>, "reclamos"],
        ["9. Devoluciones y garantías", <>
          <p>
            Los productos dañados, incompletos o distintos se devuelven y reembolsan por medio de un reclamo dentro de las 48 horas siguientes a
            la entrega. Los defectos que no se podían ver al recibir siguen cubiertos por la garantía de la Ley 842. Las artesanías hechas a mano
            pueden variar ligeramente respecto a la foto.
          </p>
          <p>
            Detalles en{" "}
            <Link href="/politicas#devoluciones" className="text-primary underline">Devoluciones y garantías</Link>.
          </p>
        </>, "garantias"],
        ["10. Cancelaciones y reembolsos", <>
          <p>
            Solo el negocio o la administración pueden cancelar un pedido pagado, indicando el motivo. Toda cancelación antes de la entrega
            reembolsa el total al medio de pago original. El reembolso se ordena al momento y, según el banco, se refleja en 5 a 10 días hábiles.
          </p>
          <p>
            Cada caso y su monto están en la{" "}
            <Link href="/politicas#reembolsos" className="text-primary underline">Política de reembolso</Link>.
          </p>
        </>, "reembolsos"],
        ["11. Vendedores", `Hay dos niveles. "Emprendedor verificado" (sin RUC): presenta cédula, selfie con la cédula, fotos y ubicación del lugar, y recibe una visita de verificación antes de ser aprobado; tiene límites de pedidos y ventas mensuales que aumentan con su historial. "Negocio formal": presenta RUC, cédula del representante y matrícula de la Alcaldía. Ambos firman una declaración jurada y pagan la misma comisión sobre los productos. Los primeros productos de cada negocio se publican tras la revisión de la administración. Las liquidaciones se transfieren a la cuenta registrada a nombre del titular.`],
        ["12. Faltas y suspensión", "El negocio recibe una falta al cancelar un pedido pagado, no prepararlo a tiempo, cuando el repartidor lo rechaza en la recolección o cuando se aprueba un reclamo a su cargo. Con 3 faltas en 90 días la tienda se suspende automáticamente hasta que la administración la revise. El fraude comprobado implica la baja y la retención del saldo para cubrir reembolsos. La administración también puede bloquear cuentas de clientes que abusen de los reclamos."],
        ["13. Datos personales y seguridad", <p key="body">
          Tratamos tus datos según el <Link href="/privacidad" className="text-primary underline">Aviso de privacidad</Link> (Ley 787) y
          protegemos la plataforma como se explica en{" "}
          <Link href="/seguridad" className="text-primary underline">Seguridad de la plataforma</Link> (Ley 1042).
        </p>, "datos"],
        ["14. Proyecto de demostración", "Mientras la plataforma opere en modo de prueba, los pagos se procesan con Stripe en modo test o con una pasarela simulada, sin movimiento de dinero real."],
      ]}
    />
  );
}
