// Primero: los stores persistentes (carrito, ubicación) leen este localStorage al crearse.
import 'expo-sqlite/localStorage/install';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { Outfit_500Medium } from '@expo-google-fonts/outfit/500Medium';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { needsProfileCompletion } from '@/lib/roles';
import { AnimatedSplash } from '~/components/brand/animated-splash';
import { ToastHost } from '~/components/ui/toast';
import { SessionProvider, useSession } from '~/features/auth/session';
import { CartSync } from '~/features/cart/cart-sync';
import { usePushRegistration, usePushTaps } from '~/features/push/push';
import { colors, fonts } from '~/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

/** Tras este tiempo en segundo plano, volver a la app repite la animación (versión corta). */
const REPLAY_AFTER_MS = 10 * 60 * 1000;

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Outfit_500Medium, Outfit_600SemiBold, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <App fontsLoaded={fontsLoaded} />
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function App({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { ready, session, profile } = useSession();
  const shopper = session && (!profile || profile.role === 'customer') ? session.user.id : null;
  // Push: todos los roles de la app (el admin usa el web).
  usePushRegistration(profile && profile.role !== 'admin' ? profile.id : null);
  const [splash, setSplash] = useState<{ key: number; variant: 'full' | 'short' } | null>({ key: 0, variant: 'full' });
  const backgroundAt = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundAt.current = Date.now();
      if (state === 'active' && backgroundAt.current && Date.now() - backgroundAt.current >= REPLAY_AFTER_MS) {
        setSplash((current) => ({ key: (current?.key ?? 0) + 1, variant: 'short' }));
      }
      if (state === 'active') backgroundAt.current = null;
    });
    return () => subscription.remove();
  }, []);

  const finishSplash = useCallback(() => setSplash(null), []);

  return (
    <>
      <StatusBar style={splash ? 'light' : 'dark'} />
      {fontsLoaded && (
        <>
          <RoleGate />
          {ready && <CartSync userId={shopper} />}
          <Stack
            screenOptions={{
              headerTintColor: colors.foreground,
              headerTitleStyle: { fontFamily: fonts.display, fontSize: 18 },
              headerStyle: { backgroundColor: colors.background },
              headerShadowVisible: false,
              headerBackButtonDisplayMode: 'minimal',
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tienda)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="vendedor" options={{ headerShown: false }} />
            <Stack.Screen name="repartidor" options={{ headerShown: false }} />
            <Stack.Screen name="solo-web" options={{ headerShown: false }} />
            <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
          </Stack>
          <ToastHost />
        </>
      )}
      {splash && <AnimatedSplash key={splash.key} variant={splash.variant} ready={ready && fontsLoaded} onFinish={finishSplash} />}
    </>
  );
}

/** Áreas de la app según el primer segmento de la ruta. */
const SHARED = new Set(['(auth)', 'auth', 'notificaciones', 'completar-perfil']);

/**
 * Lleva a cada rol a su área: el cliente compra (y puede pedir abrir su negocio
 * en /vendedor/solicitud), el vendedor y el repartidor usan su panel, y el
 * administrador solo ve el aviso de usar el panel web.
 */
function RoleGate() {
  const { ready, session, profile } = useSession();
  usePushTaps();
  const segments = useSegments() as string[];
  const pathname = usePathname();
  const router = useRouter();
  const area = segments[0] ?? '';
  const inVendor = area === 'vendedor';
  const inCourier = area === 'repartidor';

  useEffect(() => {
    if (!ready) return;
    if (!session || !profile) {
      // Sin sesión: a entrar, y luego de vuelta (p. ej. a la solicitud de negocio).
      if (inVendor || inCourier || area === 'solo-web' || area === 'completar-perfil') {
        router.replace({ pathname: '/login', params: inVendor ? { next: pathname } : {} });
      }
      return;
    }
    // Login, registro y regreso de Google navegan solos al iniciar sesión
    // (useGoToHomeWhenSignedIn): si el guardián también lo hiciera, se verían dos saltos.
    if (area === '(auth)' || area === 'auth') return;
    if (profile.role === 'admin') {
      if (area !== 'solo-web') router.replace('/solo-web');
      return;
    }
    if (area === 'solo-web') router.replace('/');
    if (needsProfileCompletion(profile)) {
      if (area !== 'completar-perfil') router.replace('/completar-perfil');
      return;
    }
    if (SHARED.has(area)) return;
    if (profile.role === 'courier' && !inCourier) router.replace('/repartidor');
    // El vendedor puede ver su propia página y productos como los ven sus clientes
    // (las pantallas comprueban que sean suyos).
    else if (profile.role === 'vendor' && !inVendor && area !== 'negocios' && area !== 'productos') router.replace('/vendedor/panel');
    else if (profile.role === 'customer' && inCourier) router.replace('/');
  }, [ready, session, profile, area, inVendor, inCourier, router, pathname]);

  return null;
}

const styles = StyleSheet.create({ root: { flex: 1 } });
