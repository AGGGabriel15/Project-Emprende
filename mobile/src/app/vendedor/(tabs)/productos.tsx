import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Minus, Package, Plus, Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { setProductActiveWith, updateStockWith } from '@/features/businesses/mutations';
import { formatMoney } from '@/lib/format';
import type { Product } from '@/types/domain';
import { PanelHeader } from '~/components/layout/panel-header';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { EmptyState, Skeleton } from '~/components/ui/feedback';
import { Screen } from '~/components/ui/screen';
import { Text } from '~/components/ui/text';
import { useMyBusiness, useVendorAction, useVendorProducts } from '~/features/vendor/queries';
import { colors, fonts, radius } from '~/theme/tokens';

export default function VendorProducts() {
  const router = useRouter();
  const business = useMyBusiness().data!;
  const products = useVendorProducts(business.id);
  const [q, setQ] = useState('');
  const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const list = (products.data ?? []).filter((p) => !q || normalize(p.name).includes(normalize(q)));
  const readOnly = business.status !== 'approved';

  return (
    <Screen
      edges={['top']}
      refreshing={products.isRefetching}
      onRefresh={() => void products.refetch()}
      footer={
        readOnly ? undefined : (
          <Button icon={Plus} onPress={() => router.push('/vendedor/productos/nuevo')} block>
            Nuevo producto
          </Button>
        )
      }
    >
      <PanelHeader title="Productos" subtitle="Precio, stock y visibilidad. Tus primeros productos los revisa la administración." />
      <View style={styles.search}>
        <Search size={18} color={colors.mutedForeground} />
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar en mi catálogo" placeholderTextColor={colors.mutedForeground} style={styles.input} />
      </View>
      {products.isLoading ? (
        <Skeleton height={90} />
      ) : list.length ? (
        list.map((p, i) => (
          <Animated.View key={p.id} entering={FadeInDown.delay(Math.min(i, 8) * 40)} layout={LinearTransition}>
            <ProductRow product={p} readOnly={readOnly} onPress={() => router.push(`/vendedor/productos/${p.id}`)} />
          </Animated.View>
        ))
      ) : (
        <EmptyState
          icon={Package}
          title={q ? 'Sin resultados' : 'Aún no tienes productos'}
          description={q ? undefined : 'Agrega tu primer producto con fotos, precio y stock.'}
        />
      )}
    </Screen>
  );
}

function ProductRow({ product, readOnly, onPress }: { product: Product; readOnly: boolean; onPress: () => void }) {
  const stock = useVendorAction(updateStockWith, { invalidate: ['vendor-products', 'vendor-dashboard'] });
  const active = useVendorAction(setProductActiveWith, { invalidate: ['vendor-products'] });
  const [draft, setDraft] = useState<number | null>(null);
  const value = draft ?? product.stock;
  const commit = (next: number) => {
    setDraft(next);
    stock.mutate([product.id, next], { onSettled: () => setDraft(null) });
  };
  return (
    <Card onPress={onPress} style={styles.row}>
      <View style={styles.thumb}>{product.images[0] ? <Image source={product.images[0]} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
      <View style={styles.flex}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {product.name}
        </Text>
        <Text variant="small" tone="muted">
          {formatMoney(product.price_minor)}
        </Text>
        <View style={styles.badges}>
          {!product.is_active && <Badge tone="neutral">Oculto</Badge>}
          {product.review_status === 'pending' && <Badge tone="blue">En revisión</Badge>}
          {product.review_status === 'rejected' && <Badge tone="red">Con observaciones</Badge>}
          {value === 0 && <Badge tone="amber">Agotado</Badge>}
        </View>
        {product.review_status === 'rejected' && product.review_note ? (
          <Text variant="small" tone="danger">
            Corrige: {product.review_note}
          </Text>
        ) : null}
      </View>
      {!readOnly && (
        <View style={styles.side}>
          <Switch
            value={product.is_active}
            onValueChange={(next) => active.mutate([product.id, next])}
            trackColor={{ true: colors.catarina, false: colors.border }}
            thumbColor={colors.white}
            accessibilityLabel="Visible en la tienda"
          />
          <View style={styles.stepper}>
            <Pressable hitSlop={6} onPress={() => commit(Math.max(0, value - 1))} accessibilityLabel="Menos stock">
              <Minus size={14} color={colors.foreground} />
            </Pressable>
            <Text style={styles.stock}>{value}</Text>
            <Pressable hitSlop={6} onPress={() => commit(value + 1)} accessibilityLabel="Más stock">
              <Plus size={14} color={colors.foreground} />
            </Pressable>
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 14 },
  input: { flex: 1, height: '100%', fontFamily: fonts.sans, fontSize: 15, color: colors.foreground },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.muted, overflow: 'hidden' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  side: { alignItems: 'flex-end', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 4 },
  stock: { minWidth: 22, textAlign: 'center', fontFamily: fonts.sansBold, fontSize: 14, color: colors.foreground },
});
