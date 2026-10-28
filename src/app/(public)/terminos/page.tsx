import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Términos y condiciones" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Términos y condiciones"
      updated="27 de octubre de 2026"
      sections={[
        ["1. Qué es Catarina Market", "Plataforma que conecta a clientes con negocios independientes de Catarina, Masaya. Cada negocio es responsable de sus productos, precios, existencias, preparación y envío. Catarina Market procesa el pago y retiene una comisión."],
        ["2. Pedidos y pagos", "Cada pedido pertenece a un solo negocio y se paga por separado. El pedido se confirma únicamente cuando la pasarela de pago acredita el cobro; los pedidos sin pago confirmado se cancelan automáticamente pasado el plazo indicado en el checkout."],
        ["3. Precios y existencias", "Los precios y el stock se verifican al momento de pagar. Si un producto se agota entre el pago y la confirmación, el pedido se cancela y el pago se devuelve íntegramente."],
        ["4. Delivery y retiro", "El delivery lo gestiona cada negocio según sus zonas y tarifas publicadas. La opción Para llevar no tiene costo de envío. Los tiempos son estimados."],
        ["5. Cancelaciones y reembolsos", "Solo el negocio o la administración pueden cancelar un pedido pagado, indicando siempre el motivo. Toda cancelación de un pedido pagado genera el reembolso del total al medio de pago original."],
        ["6. Vendedores", `Los negocios deben presentar RUC, cédula del representante y matrícula de la Alcaldía, y aceptar la comisión vigente por pedido sobre el subtotal de productos. La tarifa de delivery no paga comisión. Las liquidaciones se transfieren a la cuenta registrada por período.`],
        ["7. Suspensión", "La administración puede suspender negocios o cuentas que incumplan estos términos. Un negocio suspendido deja de aparecer en el catálogo y conserva sus datos."],
        ["8. Proyecto de demostración", "Mientras la plataforma opere en modo de prueba, los pagos se procesan con Stripe en modo test o con una pasarela simulada, sin movimiento de dinero real."],
      ]}
    />
  );
}
