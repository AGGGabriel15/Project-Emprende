import { Stack } from 'expo-router';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { formatPhone } from '@/lib/phone';
import type { Address } from '@/types/domain';
import { AddressSheet } from '~/components/account/address-sheet';
import { Badge } from '~/components/ui/badge';
import { Button, IconButton } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { EmptyState, Skeleton } from '~/components/ui/feedback';
import { Screen } from '~/components/ui/screen';
import { Text } from '~/components/ui/text';
import { useAddresses, useDeleteAddress } from '~/features/account/addresses';

export default function AddressesScreen() {
  const addresses = useAddresses();
  const remove = useDeleteAddress();
  const [editing, setEditing] = useState<{ key: number; address: Address | null } | null>(null);

  return (
    <Screen refreshing={addresses.isRefetching} onRefresh={addresses.refetch}>
      <Stack.Screen options={{ title: 'Mis direcciones' }} />
      <Button icon={Plus} onPress={() => setEditing({ key: Date.now(), address: null })}>
        Agregar dirección
      </Button>
      {addresses.isLoading ? (
        <Skeleton height={90} />
      ) : addresses.data?.length ? (
        addresses.data.map((a) => (
          <Card key={a.id} style={styles.card}>
            <View style={styles.flex}>
              <View style={styles.row}>
                <Text variant="bodyMedium">{a.label}</Text>
                {a.is_default && <Badge>Principal</Badge>}
              </View>
              <Text variant="small">{a.address_line}</Text>
              <Text variant="small" tone="muted">
                Recibe {a.recipient_name} · {formatPhone(a.phone)}
              </Text>
            </View>
            <IconButton icon={Pencil} label="Editar" onPress={() => setEditing({ key: Date.now(), address: a })} />
            <IconButton
              icon={Trash2}
              label="Eliminar"
              onPress={() =>
                Alert.alert('Eliminar dirección', `¿Eliminar "${a.label}"?`, [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Eliminar', style: 'destructive', onPress: () => remove.mutate(a.id) },
                ])
              }
            />
          </Card>
        ))
      ) : (
        <EmptyState icon={MapPin} title="Sin direcciones guardadas" description="Guárdalas para pagar más rápido." />
      )}
      {editing && <AddressSheet key={editing.key} open address={editing.address} onClose={() => setEditing(null)} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
