import * as Location from 'expo-location';
import { LocateFixed } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { formatPhone } from '@/lib/phone';
import type { Address } from '@/types/domain';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { PhoneInput } from '~/components/ui/phone-input';
import { Select } from '~/components/ui/select';
import { Sheet } from '~/components/ui/sheet';
import { Text } from '~/components/ui/text';
import { toast } from '~/components/ui/toast';
import { useSaveAddress } from '~/features/account/addresses';
import { useSession } from '~/features/auth/session';
import { useDepartments, useMunicipalities } from '~/features/location/geo';
import { colors } from '~/theme/tokens';

/** Formulario de dirección (nueva o editar) en un panel que sube con el teclado. */
export function AddressSheet({
  open,
  onClose,
  address,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  address?: Address | null;
  onSaved?: (address: Address) => void;
}) {
  const { profile } = useSession();
  const save = useSaveAddress();
  const [form, setForm] = useState(() => initial(address, profile));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [locating, setLocating] = useState(false);
  const departments = useDepartments();
  const municipalities = useMunicipalities(form.departmentId);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  // Rellena calle y barrio desde el GPS (el departamento y la ciudad se eligen abajo).
  async function fillFromGps() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return toast.error('Activa el permiso de ubicación para usarla.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync(position.coords);
      const line = [place?.street, place?.streetNumber, place?.district, place?.subregion].filter(Boolean).join(', ');
      if (line) set({ addressLine: line });
      else toast.error('No encontramos la dirección; escríbela con un punto de referencia.');
    } catch {
      toast.error('No pudimos leer tu ubicación.');
    } finally {
      setLocating(false);
    }
  }

  async function submit() {
    const result = await save.mutateAsync({
      input: { ...form, departmentId: form.departmentId ?? 0, municipalityId: form.municipalityId ?? 0 },
      id: address?.id,
    });
    if (!result.ok) {
      const fieldErrors = Object.fromEntries(Object.entries(result.fieldErrors ?? {}).map(([k, v]) => [k, v[0]!]));
      setErrors(fieldErrors);
      return toast.error(result.error);
    }
    setErrors({});
    toast.success('Dirección guardada.');
    onSaved?.(result.data);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={address ? 'Editar dirección' : 'Nueva dirección'}
      description="Incluye barrio y un punto de referencia para el repartidor."
      footer={
        <Button onPress={submit} loading={save.isPending} block style={styles.flex}>
          Guardar dirección
        </Button>
      }
    >
      <Input label="Nombre" placeholder="Casa, Trabajo…" value={form.label} onChangeText={(label) => set({ label })} error={errors.label} />
      <Select
        label="Departamento"
        value={form.departmentId}
        options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
        onChange={(departmentId) => set({ departmentId, municipalityId: null })}
        error={errors.departmentId}
      />
      <Select
        label="Ciudad / municipio"
        value={form.municipalityId}
        disabled={!form.departmentId}
        placeholder={form.departmentId ? 'Elige…' : 'Primero el departamento'}
        options={(municipalities.data ?? []).map((m) => ({ value: m.id, label: m.name }))}
        onChange={(municipalityId) => set({ municipalityId })}
        error={errors.municipalityId}
      />
      <Input
        label="Dirección"
        multiline
        placeholder="Barrio, calle y punto de referencia (ej.: del parque 2 c. al sur)"
        value={form.addressLine}
        onChangeText={(addressLine) => set({ addressLine })}
        error={errors.addressLine}
        right={
          <Pressable onPress={fillFromGps} disabled={locating} hitSlop={8} style={styles.locate}>
            <LocateFixed size={14} color={colors.catarina} />
            <Text variant="smallMedium" tone="primary">
              {locating ? 'Ubicando…' : 'Usar mi ubicación'}
            </Text>
          </Pressable>
        }
      />
      <Input label="¿Quién recibe?" value={form.recipientName} onChangeText={(recipientName) => set({ recipientName })} error={errors.recipientName} />
      <PhoneInput value={form.phone} onChange={(phone) => set({ phone })} error={errors.phone} />
      <View style={styles.switch}>
        <Text variant="body" style={styles.flex}>
          Usar como dirección principal
        </Text>
        <Switch
          value={form.isDefault}
          onValueChange={(isDefault) => set({ isDefault })}
          trackColor={{ true: colors.catarina, false: colors.border }}
          thumbColor={colors.white}
        />
      </View>
    </Sheet>
  );
}

function initial(address: Address | null | undefined, profile: ReturnType<typeof useSession>['profile']) {
  return {
    label: address?.label ?? '',
    departmentId: (address?.department_id ?? profile?.department_id ?? null) as number | null,
    municipalityId: (address?.municipality_id ?? profile?.municipality_id ?? null) as number | null,
    addressLine: address?.address_line ?? '',
    recipientName: address?.recipient_name ?? profile?.full_name ?? '',
    phone: formatPhone(address?.phone ?? profile?.phone),
    isDefault: address?.is_default ?? false,
  };
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  locate: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  switch: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
