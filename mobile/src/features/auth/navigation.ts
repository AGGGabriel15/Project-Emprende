import { useQueryClient } from '@tanstack/react-query';
import { useIsFocused, useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { needsProfileCompletion } from '@/lib/roles';
import type { Profile } from '@/types/domain';
import { safeNext } from '~/lib/forms';
import { useSession } from './session';

/** Pantalla de inicio de cada rol (la misma regla que el guardián de roles). */
export function homeFor(profile: Pick<Profile, 'role' | 'phone' | 'department_id'>, next?: unknown): Href {
  if (profile.role === 'admin') return '/solo-web';
  if (needsProfileCompletion(profile)) return '/completar-perfil';
  if (profile.role === 'courier') return '/repartidor';
  if (profile.role === 'vendor') return '/vendedor/panel';
  return safeNext(next);
}

/**
 * Login, registro y regreso de Google: en cuanto la sesión tiene perfil, va
 * directo a la pantalla de su rol. Así no se ve el Inicio un instante antes del
 * panel (antes se navegaba al Inicio y luego el guardián corregía).
 */
export function useGoToHomeWhenSignedIn(next?: unknown, { evenIfSignedIn = false } = {}) {
  const router = useRouter();
  const { session, profile } = useSession();
  // Solo navega la pantalla visible: si el regreso de Google abrió auth/callback
  // encima del login, navega esa y no las dos (se veían dos saltos).
  const focused = useIsFocused();
  const done = useRef(false);
  // Al llegar desde "Cerrar sesión" la sesión vieja sigue un instante: solo
  // cuenta un inicio de sesión nuevo (sin sesión → con sesión).
  const hadSession = useRef(!evenIfSignedIn && Boolean(session));
  useEffect(() => {
    if (!session) {
      hadSession.current = false;
      return;
    }
    // Una cuenta desactivada la cierra el propio login.
    if (done.current || hadSession.current || !focused || !profile || !profile.is_active) return;
    done.current = true;
    router.replace(homeFor(profile, next));
  }, [session, profile, next, router, focused]);
}

/**
 * Cerrar sesión: primero va al login (así ninguna pantalla del panel se queda
 * sin sesión y salta a otra) y luego cierra la sesión y borra los datos en caché.
 */
export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { signOut } = useSession();
  return async () => {
    if (router.canDismiss()) router.dismissAll();
    router.replace('/login');
    await signOut();
    queryClient.clear();
  };
}
