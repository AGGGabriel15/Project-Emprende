import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Camera, KeyRound, PackageCheck, Truck, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, Switch, View } from 'react-native';
import { setServicesWith } from '@/features/businesses/mutations';
import { formatMoney } from '@/lib/format';
import { Card } from '~/components/ui/card';
import { Screen } from '~/components/ui/screen';
import { Text } from '~/components/ui/text';
import { usePlatformZones } from '~/features/catalog/queries';
import { useMyBusiness, useVendorAction } from '~/features/vendor/queries';
import { supabase } from '~/lib/supabase';
import { colors } from '~/theme/tokens';

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Camera, title: 'Empacas y tomas una foto', text: 'Marca el pedido como listo desde Pedidos.' },
  { icon: Truck, title: 'El repartidor lo recoge', text: 'Compara el paquete con tu foto; si no coincide, lo rechaza.' },
  { icon: KeyRound, title: 'Se entrega con PIN', text: 'El cliente da su código solo al recibirlo.' },
  { icon: PackageCheck, title: 'Cobras', text: '48 h después de la entrega, si no hay reclamos.' },
];

export default function DeliveryScreen() {
  const business = useMyBusiness().data!;
  const zones = usePlatformZones();
  const services = useVendorAction(setServicesWith, { success: 'Guardado.', invalidate: ['my-business'] });
  const places = useQuery({
    queryKey: ['zone-places'],
    staleTime: Infinity,
    queryFn: async () => {
      const [departments, municipalities] = await Promise.all([
        supabase.from('departments').select('id, name'),
        supabase.from('municipalities').select('id, name'),
      ]);
      return {
        departments: new Map((departments.data ?? []).map((d) => [d.id as number, d.name as string])),
        municipalities: new Map((municipalities.data ?? []).map((m) => [m.id as number, m.name as string])),
      };
    },
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Delivery y retiro' }} />
      <Text variant="small" tone="muted">
        Catarina Market se encarga del delivery: recogemos en tu negocio y entregamos al cliente. Tú no pagas el envío.
      </Text>
      <Card style={styles.gap}>
        {STEPS.map(({ icon: Icon, title, text }) => (
          <View key={title} style={styles.step}>
            <View style={styles.icon}>
              <Icon size={18} color={colors.catarina} />
            </View>
            <View style={styles.flex}>
              <Text variant="bodyMedium">{title}</Text>
              <Text variant="small" tone="muted">
                {text}
              </Text>
            </View>
          </View>
        ))}
      </Card>
      <Card style={styles.row}>
        <View style={styles.flex}>
          <Text variant="bodyMedium">Retiro en el local</Text>
          <Text variant="small" tone="muted">
            El cliente recoge el pedido y te da su PIN.
          </Text>
        </View>
        <Switch
          value={business.accepts_pickup}
          disabled={services.isPending || business.status !== 'approved'}
          onValueChange={(acceptsPickup) => services.mutate([{ acceptsPickup, acceptsDelivery: true }])}
          trackColor={{ true: colors.catarina, false: colors.border }}
          thumbColor={colors.white}
        />
      </Card>
      <Card style={styles.gap}>
        <Text variant="heading">Zonas con delivery</Text>
        <Text variant="small" tone="muted">
          Las tarifas las define Catarina Market y las paga el cliente.
        </Text>
        {(zones.data ?? []).map((zone) => (
          <View key={zone.id} style={styles.zone}>
            <Text variant="small">
              {zone.municipality_id ? places.data?.municipalities.get(zone.municipality_id) : `Todo ${places.data?.departments.get(zone.department_id) ?? ''}`}
            </Text>
            <Text variant="small" tone="muted">
              {formatMoney(zone.fee_minor)}
            </Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  gap: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  step: { flexDirection: 'row', gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.niebla, alignItems: 'center', justifyContent: 'center' },
  zone: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.muted },
});
