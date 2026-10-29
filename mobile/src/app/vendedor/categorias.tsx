import { Stack } from 'expo-router';
import { ArrowDown, ArrowUp, FolderTree, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { deleteProductCategoryWith, reorderProductCategoriesWith, saveProductCategoryWith } from '@/features/businesses/mutations';
import type { ProductCategory } from '@/types/domain';
import { Button, IconButton } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { EmptyState, Skeleton } from '~/components/ui/feedback';
import { Input } from '~/components/ui/input';
import { Screen } from '~/components/ui/screen';
import { Sheet } from '~/components/ui/sheet';
import { Text } from '~/components/ui/text';
import { useMyBusiness, useProductCategories, useVendorAction } from '~/features/vendor/queries';

/** Secciones de la tienda (p. ej. Alcancías, Jarrones): el orden aquí es el de tu página. */
export default function CategoriesScreen() {
  const business = useMyBusiness().data!;
  const categories = useProductCategories(business.id);
  const save = useVendorAction(saveProductCategoryWith, { invalidate: ['product-categories'] });
  const reorder = useVendorAction(reorderProductCategoriesWith, { invalidate: ['product-categories'] });
  const remove = useVendorAction(deleteProductCategoryWith, { success: 'Sección eliminada.', invalidate: ['product-categories'] });
  const [editing, setEditing] = useState<{ category: ProductCategory | null; name: string } | null>(null);
  const list = categories.data ?? [];

  function move(index: number, delta: number) {
    const ids = list.map((c) => c.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved!);
    reorder.mutate([ids]);
  }

  return (
    <Screen
      refreshing={categories.isRefetching}
      onRefresh={() => void categories.refetch()}
      footer={
        <Button icon={Plus} block onPress={() => setEditing({ category: null, name: '' })}>
          Nueva sección
        </Button>
      }
    >
      <Stack.Screen options={{ title: 'Secciones' }} />
      <Text variant="small" tone="muted">
        Agrupan tus productos en tu página (p. ej. Alcancías, Jarrones, Maceteras). El orden aquí es el que ven los clientes.
      </Text>
      {categories.isLoading ? (
        <Skeleton height={80} />
      ) : list.length === 0 ? (
        <EmptyState icon={FolderTree} title="Sin secciones" description="Crea secciones para ordenar tu catálogo." />
      ) : (
        <Card padded={false}>
          {list.map((c, i) => (
            <Animated.View key={c.id} layout={LinearTransition} style={[styles.row, i < list.length - 1 && styles.border]}>
              <Text variant="bodyMedium" style={styles.flex}>
                {c.name}
              </Text>
              <IconButton icon={ArrowUp} label="Subir" onPress={() => i > 0 && move(i, -1)} size={34} />
              <IconButton icon={ArrowDown} label="Bajar" onPress={() => i < list.length - 1 && move(i, 1)} size={34} />
              <IconButton icon={Pencil} label="Renombrar" onPress={() => setEditing({ category: c, name: c.name })} size={34} />
              <IconButton
                icon={Trash2}
                label="Eliminar"
                size={34}
                onPress={() =>
                  Alert.alert('Eliminar sección', `Los productos de "${c.name}" quedarán sin sección.`, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: () => remove.mutate([c.id]) },
                  ])
                }
              />
            </Animated.View>
          ))}
        </Card>
      )}
      {editing && (
        <Sheet
          open
          onClose={() => setEditing(null)}
          title={editing.category ? 'Renombrar sección' : 'Nueva sección'}
          footer={
            <Button
              block
              style={styles.flex}
              loading={save.isPending}
              onPress={() => save.mutate([{ name: editing.name }, editing.category?.id], { onSuccess: () => setEditing(null) })}
            >
              Guardar
            </Button>
          }
        >
          <Input label="Nombre" value={editing.name} onChangeText={(name) => setEditing((e) => (e ? { ...e, name } : e))} autoFocus />
        </Sheet>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 16, paddingRight: 6, paddingVertical: 8 },
  border: { borderBottomWidth: 1, borderBottomColor: '#F0F6F2' },
});
