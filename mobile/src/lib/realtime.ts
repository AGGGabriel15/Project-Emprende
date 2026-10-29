import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase, realtimeChannel } from './supabase';

/**
 * Escucha cambios de una tabla (con filtro, p. ej. `id=eq.<pedido>`, o "*"
 * para toda la tabla visible por RLS) y vuelve a cargar las consultas
 * indicadas. Equivale a RealtimeRefresh del web. null la desactiva.
 */
export function useRealtimeRefresh(table: 'orders' | 'shipments' | 'notifications', filter: string | null, queryKey: QueryKey) {
  const queryClient = useQueryClient();
  const key = JSON.stringify(queryKey);
  useEffect(() => {
    if (!filter) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    realtimeChannel(`${table}:${filter}`).then((ch) => {
      if (cancelled) return;
      channel = ch
        .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter === '*' ? {} : { filter }) }, () => {
          queryClient.invalidateQueries({ queryKey: JSON.parse(key) as QueryKey });
        })
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [table, filter, key, queryClient]);
}
