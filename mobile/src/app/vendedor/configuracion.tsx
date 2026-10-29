import { Stack } from 'expo-router';
import { useState } from 'react';
import { updateBusinessSettingsWith } from '@/features/businesses/mutations';
import { formatPhone } from '@/lib/phone';
import { TIER_INFO } from '@/lib/validations/business';
import { Button } from '~/components/ui/button';
import { Card, InfoRow } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Screen } from '~/components/ui/screen';
import { Text } from '~/components/ui/text';
import { StoreFields, type StoreValues } from '~/components/vendor/store-fields';
import { actionFieldErrors, useMyBusiness, useVendorAction } from '~/features/vendor/queries';

export default function BusinessSettings() {
  const business = useMyBusiness().data!;
  const save = useVendorAction(updateBusinessSettingsWith, { success: 'Cambios guardados.', invalidate: ['my-business', 'business'] });
  const [tradeName, setTradeName] = useState(business.trade_name);
  const [store, setStore] = useState<StoreValues>({
    categoryId: business.category_id,
    description: business.description ?? '',
    departmentId: business.department_id,
    municipalityId: business.municipality_id,
    addressLine: business.address_line ?? '',
    phone: formatPhone(business.phone),
    whatsapp: formatPhone(business.whatsapp),
    logoUrl: business.logo_url ?? '',
    coverUrl: business.cover_url ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const readOnly = business.status !== 'approved';

  return (
    <Screen
      footer={
        readOnly ? undefined : (
          <Button
            block
            loading={save.isPending}
            onPress={() =>
              save.mutate(
                [{ ...store, tradeName, categoryId: store.categoryId ?? 0, departmentId: store.departmentId ?? 0, municipalityId: store.municipalityId ?? 0 }],
                { onSuccess: () => setErrors({}), onError: (e) => setErrors(actionFieldErrors(e)) },
              )
            }
          >
            Guardar cambios
          </Button>
        )
      }
    >
      <Stack.Screen options={{ title: 'Configuración' }} />
      <Card style={{ gap: 14 }}>
        <Input label="Nombre del negocio" value={tradeName} onChangeText={setTradeName} error={errors.tradeName} />
        <StoreFields values={store} onChange={(patch) => setStore((s) => ({ ...s, ...patch }))} errors={errors} />
      </Card>
      <Card>
        <Text variant="heading">Datos legales</Text>
        <Text variant="small" tone="muted">
          Para cambiarlos, contacta a la administración.
        </Text>
        <InfoRow label="Nivel" value={TIER_INFO[business.tier].label} />
        <InfoRow label="Titular" value={business.legal_name ?? '—'} />
        {business.ruc ? <InfoRow label="RUC" value={business.ruc} /> : null}
      </Card>
    </Screen>
  );
}
