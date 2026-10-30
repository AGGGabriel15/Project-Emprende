import 'expo-sqlite/localStorage/install';
// Antes del cliente: WebCrypto para el PKCE del login con Google.
import './crypto-polyfill';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

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

