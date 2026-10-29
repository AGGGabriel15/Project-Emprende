import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '~/components/ui/button';
import { Select } from '~/components/ui/select';
import { Sheet } from '~/components/ui/sheet';
import { Text } from '~/components/ui/text';
import { toast } from '~/components/ui/toast';
import { useSession } from '~/features/auth/session';
import { useDepartments, useMunicipalities, useVisitorLocation } from '~/features/location/geo';
import { useDelivery } from '~/features/location/use-delivery';
import { supabase } from '~/lib/supabase';
import { colors, radius } from '~/theme/tokens';

/** "Entregar en …": elige departamento y ciudad para ver cobertura y tarifa del delivery. */
export function LocationChip({ tone = 'light' }: { tone?: 'light' | 'glass' }) {
  const { location } = useDelivery();
  const { session, refreshProfile } = useSession();
  const setVisitor = useVisitorLocation((s) => s.setLocation);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ departmentId: number | null; municipalityId: number | null }>({ departmentId: null, municipalityId: null });
  const departments = useDepartments();
  const current = useMunicipalities(location?.departmentId);
  const options = useMunicipalities(draft.departmentId);
  const town = current.data?.find((m) => m.id === location?.municipalityId)?.name;
  const glass = tone === 'glass';

  async function save() {
    if (!draft.departmentId || !draft.municipalityId) return toast.error('Elige departamento y ciudad.');
    const next = { departmentId: draft.departmentId, municipalityId: draft.municipalityId };
    setVisitor(next);
    if (session) {
      await supabase.from('profiles').update({ department_id: next.departmentId, municipality_id: next.municipalityId }).eq('id', session.user.id);
      await refreshProfile();
    }
    queryClient.invalidateQueries({ queryKey: ['businesses'] });
    setOpen(false);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cambiar ubicación de entrega"
        onPress={() => {
          setDraft({ departmentId: location?.departmentId ?? null, municipalityId: location?.municipalityId ?? null });
          setOpen(true);
        }}
        style={[styles.chip, glass ? styles.glass : styles.light]}
      >
        <MapPin size={16} color={glass ? colors.white : colors.catarina} />
        <View style={styles.text}>
          <Text variant="small" tone={glass ? 'white' : 'muted'} style={styles.caption}>
            Entregar en
          </Text>
          <Text variant="smallMedium" tone={glass ? 'white' : 'default'} numberOfLines={1}>
            {town ?? 'Elige tu ubicación'}
          </Text>
        </View>
        <ChevronDown size={16} color={glass ? colors.white : colors.mutedForeground} />
      </Pressable>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="¿Dónde estás?"
        description="Te mostramos qué negocios envían a tu zona y cuánto cuesta el delivery."
        footer={
          <Button onPress={save} block style={styles.flex}>
            Guardar ubicación
          </Button>
        }
      >
        <Select
          label="Departamento"
          value={draft.departmentId}
          options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
          onChange={(departmentId) => setDraft({ departmentId, municipalityId: null })}
        />
        <Select
          label="Ciudad / municipio"
          value={draft.municipalityId}
          disabled={!draft.departmentId}
          placeholder={draft.departmentId ? 'Elige…' : 'Primero el departamento'}
          options={(options.data ?? []).map((m) => ({ value: m.id, label: m.name }))}
          onChange={(municipalityId) => setDraft((d) => ({ ...d, municipalityId }))}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 220,
    borderWidth: 1,
  },
  light: { backgroundColor: colors.card, borderColor: colors.border },
  glass: { backgroundColor: 'rgba(14,59,39,0.35)', borderColor: 'rgba(255,255,255,0.4)' },
  text: { flexShrink: 1 },
  caption: { fontSize: 10, lineHeight: 12 },
  flex: { flex: 1 },
});
