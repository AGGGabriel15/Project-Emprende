import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '~/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

/**
 * Inicia sesión con Google: abre la pantalla de Google en el navegador
 * integrado y vuelve a la app (catarinamarket://auth/callback) con el código
 * PKCE, que se canjea por la sesión. La URL de regreso debe estar en Supabase
 * → Auth → URL Configuration → Redirect URLs.
 */
export async function signInWithGoogle(): Promise<{ ok: true } | { ok: false; error?: string }> {
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) return { ok: false, error: 'No pudimos conectar con Google.' };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return { ok: false };
  return exchangeFromUrl(result.url);
}

/** Canjea el código del enlace de regreso (también lo usa la ruta auth/callback). */
export async function exchangeFromUrl(url: string): Promise<{ ok: true } | { ok: false; error?: string }> {
  const { queryParams } = Linking.parse(url);
  const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
  if (!code) {
    const description = typeof queryParams?.error_description === 'string' ? queryParams.error_description : undefined;
    return { ok: false, error: description ?? 'Google no devolvió la sesión.' };
  }
  const { data } = await supabase.auth.getSession();
  if (data.session) return { ok: true };
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error ? { ok: false, error: 'No pudimos iniciar sesión con Google.' } : { ok: true };
}
