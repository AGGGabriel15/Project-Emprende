import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState } from 'react';
import type { Profile } from '@/types/domain';
import { unregisterPush } from '~/features/push/push';
import { supabase } from '~/lib/supabase';

type SessionState = {
  /** false hasta leer la sesión guardada en el dispositivo. */
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

async function loadProfile(userId: string) {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return (data as Profile | null) ?? null;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;
    const apply = async (next: Session | null) => {
      const nextProfile = next ? await loadProfile(next.user.id) : null;
      if (!active) return;
      setSession(next);
      setProfile(nextProfile);
      setReady(true);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      // El refresco del token no cambia el perfil: evita una consulta por hora.
      if (event === 'TOKEN_REFRESHED') setSession(next);
      else if (event !== 'INITIAL_SESSION') apply(next);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value: SessionState = {
    ready,
    session,
    profile,
    refreshProfile: async () => {
      if (session) setProfile(await loadProfile(session.user.id));
    },
    signOut: async () => {
      await unregisterPush().catch(() => {});
      await supabase.auth.signOut();
    },
  };
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession() {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession debe usarse dentro de SessionProvider.');
  return value;
}
