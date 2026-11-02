import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalTable } from "@/components/legal-page";
import { SupportContact } from "@/components/legal/support-contact";
import { deliveryTime, getLegalSettings } from "@/features/legal/settings";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Entregas, reembolsos y garantías" };
export const revalidate = 3600;

export default async function PoliciesPage() {
  const s = await getLegalSettings();
  const fee = formatMoney(s.serviceFeeMinor);
  return (
    <LegalPage
      title="Entregas, reembolsos y garantías"
      updated="1 de noviembre de 2026"
      intro={
        <p>
          Estas políticas protegen tus derechos como consumidor según la{" "}
          <strong>Ley N.º 842, Ley de Protección de los Derechos de las Personas Consumidoras y Usuarias</strong>. Forman parte de los{" "}
          <Link href="/terminos" className="text-primary underline">
            Términos y condiciones
          </Link>
          .
        </p>
      }
      sections={[
        [
          "Tiempos de entrega",
          <>
            <p>
              Después de confirmarse tu pago, el negocio tiene hasta <strong>{s.readyHours} horas</strong> para preparar tu pedido. Luego el
              tiempo depende del tipo de servicio:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Retiro en el negocio:</strong> te avisamos cuando está listo y tienes {s.pickupDays} días para recogerlo con tu PIN, en el
                horario del negocio.
              </li>
              <li>
                <strong>Delivery Catarina Market:</strong> un repartidor lo recoge y te lo lleva. Tarifas y tiempos estimados por zona:
              </li>
            </ul>
            {s.zones.length > 0 && (
              <LegalTable
                head={["Zona", "Tarifa de envío", "Tiempo estimado"]}
                rows={s.zones.map((z) => [z.place, formatMoney(z.feeMinor), deliveryTime(z.days)])}
              />
            )}
            <p className="text-sm">
              El total del checkout muestra por separado los productos, el envío y la tarifa de servicio ({fee}) antes de pagar. Si tu municipio no
              aparece, por ahora solo puedes elegir retiro en el negocio.
            </p>
          </>,
          "entregas",
        ],
        [
          "Política de reembolso",
          <>
            <LegalTable
              head={["Situación", "Qué te devolvemos"]}
              rows={[
                [`No completas el pago en ${s.payMinutes} minutos`, "Nada que devolver: el pedido se cancela sin cobro."],
                ["El negocio cancela o no prepara a tiempo", "El 100 % (productos, envío y tarifa de servicio)."],
                ["El repartidor rechaza el producto por dañado o distinto", "El 100 %."],
                ["La administración cancela el pedido", "El 100 %."],
                [`No retiras tu pedido en ${s.pickupDays} días`, `Todo, menos la tarifa de servicio (${fee}).`],
                [
                  `${s.deliveryAttempts} intentos de entrega fallidos por ausencia o dirección incorrecta`,
                  "El valor de los productos; el envío y la tarifa de servicio no se devuelven.",
                ],
                ["Reclamo aprobado", "El monto que decide la administración según la evidencia, hasta lo que pagaste."],
              ]}
            />
            <p>
              El reembolso se ordena de inmediato a la misma tarjeta con la que pagaste. Según tu banco, el dinero puede tardar de 5 a 10 días
              hábiles en reflejarse. Nunca se devuelve más de lo cobrado. Te avisamos por notificación cuando se procesa.
            </p>
          </>,
          "reembolsos",
        ],
        [
          "Devoluciones y garantías",
          <>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Si el producto llega <strong>dañado, incompleto o distinto</strong> a lo publicado, repórtalo con fotos dentro de las{" "}
                {s.claimHours} horas siguientes a la entrega: es la vía más rápida para la devolución y el reembolso.
              </li>
              <li>
                Los <strong>defectos que no se podían ver al recibir</strong> (vicios ocultos) siguen cubiertos por la garantía que establece la Ley
                842 aunque hayan pasado las {s.claimHours} horas: escríbenos a soporte con tu número de pedido y fotos.
              </li>
              <li>
                Las artesanías se hacen a mano: pueden variar un poco en color, medida o acabado respecto a la foto, sin que eso sea un defecto.
              </li>
              <li>Las plantas se entregan sanas; su cuidado después de la entrega queda a cargo del cliente.</li>
              <li>
                Para otros casos de devolución, escribe a soporte con tu número de pedido: lo revisamos con el negocio conforme a la Ley 842.
              </li>
            </ul>
          </>,
          "devoluciones",
        ],
        [
          "Cómo hacer un reclamo",
          <>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Entra a Mis pedidos, abre el pedido entregado y toca «Reportar un problema».</li>
              <li>Elige el motivo, describe qué pasó y adjunta fotos.</li>
              <li>El pedido queda «En reclamo» y el pago al negocio se detiene.</li>
              <li>
                La administración revisa tus fotos junto con las del negocio, la recogida y la entrega, y te responde con la decisión y el monto a
                reembolsar, si corresponde.
              </li>
            </ol>
            <p>
              Si no estás de acuerdo con la respuesta, puedes acudir a la <strong>Dirección de Defensa del Consumidor del MIFIC</strong> (Ministerio
              de Fomento, Industria y Comercio).
            </p>
            <SupportContact />
          </>,
          "reclamos",
        ],
      ]}
    />
  );
}
