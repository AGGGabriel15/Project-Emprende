import { Stack } from 'expo-router';
import { BadgeCheck, Hourglass } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { recordDocumentWith, requestFormalUpgradeWith } from '@/features/businesses/mutations';
import { formatDate } from '@/lib/format';
import { UPGRADE_DOCUMENTS } from '@/lib/validations/business';
import type { DocumentType } from '@/types/domain';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { EmptyState } from '~/components/ui/feedback';
import { Input } from '~/components/ui/input';
import { Screen } from '~/components/ui/screen';
import { Select } from '~/components/ui/select';
import { Text } from '~/components/ui/text';
import { DocumentField } from '~/components/vendor/media-fields';
import { PERSON_TYPES, TAX_REGIMES } from '~/features/vendor/options';
import { actionFieldErrors, useApplication, useMyBusiness, useVendorAction } from '~/features/vendor/queries';
import { colors } from '~/theme/tokens';

const BENEFITS = [
  'Hasta 30 pedidos en curso y sin tope de ventas al mes.',
  'Liquidación semanal sin retención extra de 7 días.',
  'Sello “Negocio formal” en tu página.',
  'La comisión no cambia.',
];

export default function FormalizeScreen() {
  const business = useMyBusiness().data!;
  const application = useApplication(business.id);
  const record = useVendorAction(recordDocumentWith, { success: 'Documento recibido.', invalidate: ['application'] });
  const request = useVendorAction(requestFormalUpgradeWith, { success: 'Solicitud enviada. Te avisaremos al revisarla.', invalidate: ['my-business'] });
  const [form, setForm] = useState<{ personType: 'natural' | 'juridica' | null; ruc: string; taxRegime: 'cuota_fija' | 'regimen_general' | null; municipalLicense: string }>({
    personType: null,
    ruc: '',
    taxRegime: null,
    municipalLicense: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const uploaded = new Set((application.data?.documents ?? []).map((d) => d.doc_type));
  const docsReady = UPGRADE_DOCUMENTS.every((d) => uploaded.has(d.type));

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Pasar a Negocio formal' }} />
      {business.tier === 'formal' ? (
        <EmptyState icon={BadgeCheck} title="Tu negocio ya es formal" description="¡Gracias por formalizarte!" />
      ) : business.upgrade_requested_at ? (
        <EmptyState
          icon={Hourglass}
          title="Solicitud en revisión"
          description={`Desde el ${formatDate(business.upgrade_requested_at)}. Te avisaremos en tus notificaciones.`}
        />
      ) : (
        <>
          <Text variant="small" tone="muted">
            Cuando tengas RUC y matrícula de la Alcaldía, súbelos aquí.
          </Text>
          <Card style={styles.gap}>
            <Text variant="heading">Beneficios</Text>
            {BENEFITS.map((b) => (
              <View key={b} style={styles.benefit}>
                <BadgeCheck size={16} color={colors.catarina} />
                <Text variant="small" style={styles.flex}>
                  {b}
                </Text>
              </View>
            ))}
          </Card>
          <Card style={styles.gap}>
            <Text variant="heading">Datos fiscales</Text>
            <Select label="Tipo de persona" value={form.personType} options={PERSON_TYPES} onChange={(personType) => setForm((f) => ({ ...f, personType }))} error={errors.personType} />
            <Input label="RUC (DGI)" autoCapitalize="characters" value={form.ruc} onChangeText={(ruc) => setForm((f) => ({ ...f, ruc }))} placeholder="J0310000000001" error={errors.ruc} />
            <Select label="Régimen fiscal" value={form.taxRegime} options={TAX_REGIMES} onChange={(taxRegime) => setForm((f) => ({ ...f, taxRegime }))} error={errors.taxRegime} />
            <Input label="Matrícula de la Alcaldía" value={form.municipalLicense} onChangeText={(municipalLicense) => setForm((f) => ({ ...f, municipalLicense }))} error={errors.municipalLicense} />
            {UPGRADE_DOCUMENTS.map((doc) => (
              <DocumentField
                key={doc.type}
                label={doc.label}
                uploaded={uploaded.has(doc.type)}
                onUploaded={async (path) => {
                  await record.mutateAsync([{ docType: doc.type as DocumentType, filePath: path }]);
                }}
              />
            ))}
            <Button
              disabled={!docsReady}
              loading={request.isPending}
              onPress={() => request.mutate([form], { onSuccess: () => setErrors({}), onError: (e) => setErrors(actionFieldErrors(e)) })}
            >
              Enviar a revisión
            </Button>
            {!docsReady && (
              <Text variant="small" tone="muted">
                Sube la constancia de RUC y la matrícula para enviar.
              </Text>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 12 },
  benefit: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
});
