import type { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { api, appReturnBase } from '~/lib/api';

type Router = ReturnType<typeof useRouter>;

/**
 * Abre Stripe Checkout en el navegador integrado. Al pagar (o cancelar),
 * Stripe vuelve a /api/mobile/return, que redirige a la app y el navegador se
 * cierra solo. Si la persona lo cierra a mano, el pedido sincroniza el pago.
 */
export async function openPayment(router: Router, orderId: string, url: string) {
  const result = await WebBrowser.openAuthSessionAsync(url, appReturnBase());
  const pago = result.type === 'success' ? (result.url.includes('pago=exito') ? 'exito' : 'cancelado') : 'revisar';
  router.replace({ pathname: '/pedidos/[id]', params: { id: orderId, pago } });
}

/** Reabre el pago de un pedido pendiente (o lo acredita si ya se pagó). */
export async function resumePayment(router: Router, orderId: string) {
  const result = await api<{ url: string }>(`orders/${orderId}/pay`, { app: appReturnBase() });
  if (!result.ok) return result.error;
  await openPayment(router, orderId, result.data.url);
  return null;
}
