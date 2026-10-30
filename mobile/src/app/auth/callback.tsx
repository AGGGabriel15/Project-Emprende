import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { exchangeFromUrl } from '~/features/auth/google';
import { useGoToHomeWhenSignedIn } from '~/features/auth/navigation';
import { supabase } from '~/lib/supabase';
import { colors } from '~/theme/tokens';

/**
 * Destino del enlace catarinamarket://auth/callback. En Android el sistema
 * también abre esta ruta al volver de Google: canjea el código si aún no hay
 * sesión y sigue al inicio (el guardián de roles hace el resto).
 */
export default function AuthCallback() {
  const router = useRouter();
  const url = Linking.useLinkingURL();
  // Aquí la sesión puede existir ya al llegar (la canjeó el botón de Google).
  useGoToHomeWhenSignedIn(undefined, { evenIfSignedIn: true });
  // Si no se pudo canjear el código, de vuelta al login.
  useEffect(() => {
    if (!url) return;
    exchangeFromUrl(url).then(async (result) => {
      if (result.ok) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.replace('/login');
    });
  }, [url, router]);
  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.catarina} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background } });
