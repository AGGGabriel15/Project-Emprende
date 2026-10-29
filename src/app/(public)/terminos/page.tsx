import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Términos y condiciones" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Términos y condiciones"
      updated="30 de octubre de 2026 · versión 2026-10"
      sections={[
        ["1. Qué es Catarina Market", "Plataforma que conecta a clientes con negocios de Catarina, Masaya. Cada negocio es responsable de sus productos, precios y existencias. Catarina Market cobra el pago, lo retiene hasta confirmar la entrega, entrega los pedidos con sus propios repartidores y cobra una comisión al negocio y una tarifa de servicio al cliente."],
        ["2. Pedidos y pagos", "Cada pedido pertenece a un solo negocio y se paga por adelantado en línea. El total incluye los productos, el envío (si aplica) y la tarifa de servicio. El pedido se confirma únicamente cuando la pasarela acredita el cobro; los pedidos sin pago confirmado se cancelan automáticamente."],
        ["3. Pago protegido", "El dinero queda retenido por Catarina Market. Se libera al negocio 48 horas después de la entrega si el cliente no reporta problemas. Los emprendedores verificados con pocos pedidos esperan 7 días adicionales."],
        ["4. Preparación", "El negocio debe empacar el pedido y marcarlo como listo con una foto dentro del plazo indicado (24 horas por defecto). Si no lo hace, el pedido se cancela, el cliente recibe el reembolso total y el negocio recibe una falta."],
        ["5. Delivery y retiro", "El delivery lo realizan repartidores de Catarina Market según las zonas y tarifas publicadas. El repartidor ve los datos de contacto del cliente solo mientras la entrega está en curso, compara el paquete con la foto del negocio y puede rechazarlo si no coincide o viene dañado. Cada pedido tiene un PIN de 4 dígitos que solo ve el cliente: la entrega (a domicilio o en el local del negocio) se confirma únicamente con ese PIN. El cliente debe darlo solo después de recibir y revisar su pedido."],
        ["6. Entregas fallidas y retiros vencidos", "Tras 2 intentos de entrega fallidos por ausencia del cliente o dirección incorrecta, el pedido vuelve al negocio y se reembolsan los productos, no el envío ni la tarifa de servicio. Si el cliente no retira un pedido en el local en 7 días, se cancela y se reembolsa todo menos la tarifa de servicio."],
        ["7. Reclamos", "El cliente puede reportar un problema hasta 48 horas después de la entrega, con fotos cuando el producto llegó dañado, incompleto o distinto. La administración decide con la evidencia de cada paso (foto del negocio, foto de recolección, PIN y foto de entrega). Si la responsabilidad es del negocio, el reembolso se descuenta de su liquidación; si es del repartidor o de la plataforma, lo asume Catarina Market. El cliente puede calificar al repartidor después de cada entrega. Un reclamo de \"no recibido\" sobre un pedido entregado con PIN se rechaza salvo evidencia en contrario."],
        ["8. Cancelaciones y reembolsos", "Solo el negocio o la administración pueden cancelar un pedido pagado, indicando el motivo. Toda cancelación antes de la entrega reembolsa el total al medio de pago original."],
        ["9. Vendedores", `Hay dos niveles. "Emprendedor verificado" (sin RUC): presenta cédula, selfie con la cédula, fotos y ubicación del lugar, y recibe una visita de verificación antes de ser aprobado; tiene límites de pedidos y ventas mensuales que aumentan con su historial. "Negocio formal": presenta RUC, cédula del representante y matrícula de la Alcaldía. Ambos firman una declaración jurada y pagan la misma comisión sobre los productos. Los primeros productos de cada negocio se publican tras la revisión de la administración. Las liquidaciones se transfieren a la cuenta registrada a nombre del titular.`],
        ["10. Faltas y suspensión", "El negocio recibe una falta al cancelar un pedido pagado, no prepararlo a tiempo, cuando el repartidor lo rechaza en la recolección o cuando se aprueba un reclamo a su cargo. Con 3 faltas en 90 días la tienda se suspende automáticamente hasta que la administración la revise. El fraude comprobado implica la baja y la retención del saldo para cubrir reembolsos. La administración también puede bloquear cuentas de clientes que abusen de los reclamos."],
        ["11. Proyecto de demostración", "Mientras la plataforma opere en modo de prueba, los pagos se procesan con Stripe en modo test o con una pasarela simulada, sin movimiento de dinero real."],
      ]}
    />
  );
}
