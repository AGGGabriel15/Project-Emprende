import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { exchangeFromUrl } from '~/features/auth/google';
import { colors } from '~/theme/tokens';

/**
 * Destino del enlace catarinamarket://auth/callback. En Android el sistema
 * también abre esta ruta al volver de Google: canjea el código si aún no hay
 * sesión y sigue al inicio (el guardián de roles hace el resto).
 */
export default function AuthCallback() {
  const router = useRouter();
  const url = Linking.useLinkingURL();
  useEffect(() => {
    if (!url) return;
    exchangeFromUrl(url).finally(() => router.replace('/'));
  }, [url, router]);
  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.catarina} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background } });
