import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Aviso de privacidad" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Aviso de privacidad"
      updated="27 de octubre de 2026"
      sections={[
        ["Marco legal", "Tratamos tus datos conforme a la Ley 787, Ley de Protección de Datos Personales de Nicaragua, y su reglamento. Al crear una cuenta das tu consentimiento para el tratamiento descrito aquí."],
        ["Datos que recogemos", "Nombre, correo, teléfono, ubicación (departamento y municipio), direcciones de entrega y, opcionalmente, cédula. De los vendedores, además: RUC, matrícula, documentos de verificación y cuenta bancaria para liquidaciones."],
        ["Para qué los usamos", "Para procesar pedidos y pagos, permitir que el negocio coordine la entrega, verificar a los vendedores, calcular tarifas de envío y enviarte avisos sobre tus pedidos. No vendemos tus datos."],
        ["Con quién los compartimos", "Con el negocio al que le compras (solo nombre, teléfono y dirección del pedido), con la pasarela de pago y con nuestros proveedores de infraestructura (alojamiento y correo), bajo obligaciones de confidencialidad."],
        ["Seguridad", "Los documentos de verificación se guardan en almacenamiento privado al que solo acceden el dueño del negocio y la administración, mediante enlaces temporales. El acceso a los datos está limitado por reglas de seguridad a nivel de fila."],
        ["Tus derechos", "Puedes acceder, rectificar o cancelar tus datos desde Mi cuenta o escribiendo a soporte. También puedes revocar tu consentimiento, lo que implicará cerrar la cuenta."],
      ]}
    />
  );
}
