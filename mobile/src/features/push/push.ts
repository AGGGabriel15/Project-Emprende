import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { colors } from '~/theme/tokens';
import { supabase } from '~/lib/supabase';

/**
 * Notificaciones push: cada aviso de la base (nuevo pedido, tu repartidor
 * llegó, envío disponible…) llega también al celular. Expo Go ya no recibe
 * push: se prueban con una build de desarrollo o de vista previa (EAS).
 */

const TOKEN_KEY = 'catarina-push-token';
const supported = Platform.OS !== 'web' && !isRunningInExpoGo();

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function expoPushToken() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('pedidos', {
      name: 'Pedidos y entregas',
      // eslint-disable-next-line import/namespace -- enum re-exportado que el plugin no resuelve (tsc sí)
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: colors.catarina,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const status = current.granted ? current.status : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null; // falta `eas init`
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

/** Registra este dispositivo para la cuenta con sesión (y lo reasigna si cambió de cuenta). */
export function usePushRegistration(userId: string | null) {
  useEffect(() => {
    if (!supported || !userId) return;
    let cancelled = false;
    expoPushToken()
      .then(async (token) => {
        if (!token || cancelled) return;
        const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
        if (!error) localStorage.setItem(TOKEN_KEY, token);
      })
      .catch((error) => console.warn('[push]', error));
    return () => {
      cancelled = true;
    };
  }, [userId]);
}

/** Al cerrar sesión, este dispositivo deja de recibir avisos de esa cuenta. */
export async function unregisterPush() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  await supabase.rpc('unregister_push_token', { p_token: token });
  localStorage.removeItem(TOKEN_KEY);
}

/** Tocar una notificación abre su enlace (las mismas rutas del web). */
function usePushTapsNative() {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const link = response.notification.request.content.data?.link;
    if (typeof link === 'string' && link.startsWith('/') && !link.startsWith('/admin')) router.push(link as Href);
  }, [response, router]);
}

/** En web y Expo Go no hay push: el hook no hace nada (se elige una vez, al cargar el módulo). */
export const usePushTaps: () => void = supported ? usePushTapsNative : () => {};
