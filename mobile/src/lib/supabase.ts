import 'expo-sqlite/localStorage/install';
// Antes del cliente: WebCrypto para el PKCE del login con Google.
import './crypto-polyfill';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Ninguna petición puede quedar colgada: si la red del celular se queda a medias
 * (p. ej. al volver de segundo plano), supabase-js esperaba para siempre y con él
 * todas las consultas que piden la sesión. Las subidas de fotos no tienen límite.
 */
function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (init.signal || url.includes('/storage/v1/object')) return fetch(input, init);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * Mismo proyecto de Supabase que el web, con la clave pública: RLS y las
 * funciones de la base protegen los datos. La sesión vive en el almacenamiento
 * local del dispositivo (expo-sqlite) y se refresca solo con la app activa.
 */
export const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_KEY!, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  global: { fetch: fetchWithTimeout },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/**
 * Canal de Realtime autenticado. Sin setAuth, el canal se une como anónimo y
 * RLS descarta los INSERT/UPDATE (mismo gotcha que el web).
 */
export async function realtimeChannel(name: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  await supabase.realtime.setAuth(session?.access_token ?? null);
  return supabase.channel(`${name}-${Math.random().toString(36).slice(2, 8)}`);
}

