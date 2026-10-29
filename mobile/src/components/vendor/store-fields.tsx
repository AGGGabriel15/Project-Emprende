import { StyleSheet, View } from 'react-native';
import { Input } from '~/components/ui/input';
import { PhoneInput } from '~/components/ui/phone-input';
import { Select } from '~/components/ui/select';
import { useCategories } from '~/features/catalog/queries';
import { useDepartments, useMunicipalities } from '~/features/location/geo';
import { BusinessImageField } from './media-fields';

export type StoreValues = {
  categoryId: number | null;
  description: string;
  departmentId: number | null;
  municipalityId: number | null;
  addressLine: string;
  phone: string;
  whatsapp: string;
  logoUrl: string;
  coverUrl: string;
};

/** Datos públicos del local (los usan la solicitud y Configuración, como en el web). */
export function StoreFields({
  values,
  onChange,
  errors,
}: {
  values: StoreValues;
  onChange: (patch: Partial<StoreValues>) => void;
  errors: Record<string, string>;
}) {
  const categories = useCategories();
  const departments = useDepartments();
  const municipalities = useMunicipalities(values.departmentId);
  return (
    <>
      <View style={styles.images}>
        <BusinessImageField label="Logo" value={values.logoUrl} onChange={(logoUrl) => onChange({ logoUrl })} />
        <View style={styles.flex}>
          <BusinessImageField label="Portada" wide value={values.coverUrl} onChange={(coverUrl) => onChange({ coverUrl })} />
        </View>
      </View>
      <Select
        label="Categoría"
        value={values.categoryId}
        options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        onChange={(categoryId) => onChange({ categoryId })}
        error={errors.categoryId}
      />
      <Input
        label="Descripción"
        multiline
        value={values.description}
        onChangeText={(description) => onChange({ description })}
        placeholder="Qué vendes, cómo trabajas, desde cuándo…"
        error={errors.description}
      />
      <Select
        label="Departamento"
        value={values.departmentId}
        options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
        onChange={(departmentId) => onChange({ departmentId, municipalityId: null })}
        error={errors.departmentId}
      />
      <Select
        label="Ciudad / municipio"
        value={values.municipalityId}
        disabled={!values.departmentId}
        options={(municipalities.data ?? []).map((m) => ({ value: m.id, label: m.name }))}
        onChange={(municipalityId) => onChange({ municipalityId })}
        error={errors.municipalityId}
      />
      <Input
        label="Dirección del local"
        multiline
        value={values.addressLine}
        onChangeText={(addressLine) => onChange({ addressLine })}
        placeholder="Barrio, calle y punto de referencia"
        error={errors.addressLine}
      />
      <PhoneInput label="Teléfono" value={values.phone} onChange={(phone) => onChange({ phone })} error={errors.phone} />
      <PhoneInput label="WhatsApp (opcional)" value={values.whatsapp} onChange={(whatsapp) => onChange({ whatsapp })} error={errors.whatsapp} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  images: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
});
