import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Notification } from '@/types/domain';
import { useSession } from '~/features/auth/session';
import { useRealtimeRefresh } from '~/lib/realtime';
import { supabase } from '~/lib/supabase';

/** Notificaciones del usuario (las mismas de la campana del web), en vivo. */
export function useNotifications() {
  const { session } = useSession();
  const userId = session?.user.id;
  useRealtimeRefresh('notifications', userId ? `user_id=eq.${userId}` : null, ['notifications', userId]);
  return useQuery({
    queryKey: ['notifications', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from('notifications').select('*').eq('user_id', userId!).order('created_at', { ascending: false }).limit(50);
      return (data ?? []) as Notification[];
    },
  });
}

export function useMarkNotificationsRead() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', session!.user.id).is('read_at', null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
