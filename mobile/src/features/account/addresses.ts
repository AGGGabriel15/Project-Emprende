import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { saveAddressWith } from '@/features/account/addresses';
import type { Address } from '@/types/domain';
import { useSession } from '~/features/auth/session';
import { supabase } from '~/lib/supabase';

export function useAddresses() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['addresses', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', session!.user.id)
        .order('is_default', { ascending: false })
        .order('label');
      return (data ?? []) as Address[];
    },
  });
}

/** Crea o edita una dirección (misma lógica que saveAddress del web). */
export function useSaveAddress() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, id }: { input: unknown; id?: string }) => saveAddressWith(supabase, session!.user.id, input, id),
    onSuccess: (result) => {
      if (result.ok) queryClient.invalidateQueries({ queryKey: ['addresses'] });
    },
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => supabase.from('addresses').delete().eq('id', id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  });
}
