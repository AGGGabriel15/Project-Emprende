import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Department, Municipality } from '@/types/domain';
import { supabase } from '~/lib/supabase';

/** Departamentos y municipios de Nicaragua (tablas de referencia, lectura pública). */
export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase.from('departments').select('id, name').order('name');
      return (data ?? []) as Department[];
    },
  });
}

export function useMunicipalities(departmentId: number | null | undefined) {
  return useQuery({
    queryKey: ['municipalities', departmentId],
    enabled: !!departmentId,
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase
        .from('municipalities')
        .select('id, department_id, name')
        .eq('department_id', departmentId!)
        .order('name');
      return (data ?? []) as Municipality[];
    },
  });
}

/** Ubicación del visitante (como la cookie del web): define tarifas y cobertura del delivery. */
export const useVisitorLocation = create<{
  location: { departmentId: number; municipalityId: number } | null;
  setLocation: (location: { departmentId: number; municipalityId: number }) => void;
}>()(
  persist(
    (set) => ({
      location: null,
      setLocation: (location) => set({ location }),
    }),
    { name: 'catarina-ubicacion', storage: createJSONStorage(() => localStorage) },
  ),
);
