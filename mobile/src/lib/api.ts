import * as Linking from 'expo-linking';
import type { ActionResult } from '@/types/domain';
import { supabase } from './supabase';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://catarina-market.vercel.app').replace(/\/$/, '');

/**
 * Base del enlace para volver a la app: "catarinamarket://" en las builds o
 * "exp://<ip>:8081/--/" en Expo Go. El servidor le agrega "pedidos/<id>".
 */
export function appReturnBase() {
  return Linking.createURL('pedidos').replace(/pedidos$/, '');
}

/**
 * Llama a la API móvil del web (/api/mobile/*) con el token de la sesión.
 * Solo para lo que necesita secretos del servidor: pagos y reembolsos.
 */
export async function api<T>(path: string, body: Record<string, unknown> = {}): Promise<ActionResult<T>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: 'Inicia sesión para continuar.' };
  try {
    const response = await fetch(`${API_URL}/api/mobile/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => null)) as ActionResult<T> | null;
    return result ?? { ok: false, error: 'El servicio no respondió. Intenta de nuevo en unos minutos.' };
  } catch {
    return { ok: false, error: 'Sin conexión. Revisa tu internet e intenta de nuevo.' };
  }
}

/** Reembolsos en cola de un pedido (cancelación, rechazo, entrega fallida). El cron diario es el respaldo. */
export function processRefunds(orderId: string) {
  return api<{ processed: number; failed: number }>(`orders/${orderId}/refunds`);
}

export const WEB_URL = API_URL;
