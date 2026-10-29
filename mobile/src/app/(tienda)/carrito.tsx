import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { groupByBusiness, useCart, type CartItem } from '@/features/cart/store';
import { formatMoney } from '@/lib/format';
import { Button } from '~/components/ui/button';
import { Card, Divider } from '~/components/ui/card';
import { EmptyState } from '~/components/ui/feedback';
import { Screen } from '~/components/ui/screen';
import { Text } from '~/components/ui/text';
import { useSession } from '~/features/auth/session';
import { colors, radius } from '~/theme/tokens';

export default function CartScreen() {
  const router = useRouter();
  const { session } = useSession();
  const items = useCart((s) => s.items);
  const groups = groupByBusiness(items);

  return (
    <Screen edges={['top']}>
      <Text variant="title">Tu carrito</Text>
      {groups.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Tu carrito está vacío"
          description="Agrega productos de los viveros y talleres de Catarina."
          action={<Button onPress={() => router.push('/buscar')}>Explorar productos</Button>}
        />
      ) : (
        <>
          <Text variant="small" tone="muted">
            Cada negocio es un pedido y un pago por separado.
          </Text>
          {groups.map((group, gi) => (
            <Animated.View key={group.businessId} entering={FadeInDown.delay(gi * 80).springify().damping(18)} layout={LinearTransition}>
              <Card style={styles.group}>
                <Pressable onPress={() => router.push(`/negocios/${group.businessSlug}`)}>
                  <Text variant="heading">{group.businessName}</Text>
                </Pressable>
                {group.items.map((item) => (
                  <Line key={item.productId} item={item} />
                ))}
                <Divider />
                <View style={styles.total}>
                  <Text variant="body" tone="muted">
                    Subtotal ({group.count} {group.count === 1 ? 'producto' : 'productos'})
                  </Text>
                  <Text variant="price">{formatMoney(group.subtotal)}</Text>
                </View>
                <Button
                  block
                  onPress={() => {
                    const target = `/checkout/${group.businessId}` as const;
                    if (session) router.push(target);
                    else router.push({ pathname: '/login', params: { next: target } });
                  }}
                >
                  Continuar con este pedido
                </Button>
              </Card>
            </Animated.View>
          ))}
        </>
      )}
    </Screen>
  );
}

function Line({ item }: { item: CartItem }) {
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  return (
    <Animated.View layout={LinearTransition} style={styles.line}>
      <View style={styles.thumb}>{item.image ? <Image source={item.image} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
      <View style={styles.flex}>
        <Text variant="bodyMedium" numberOfLines={2}>
          {item.name}
        </Text>
        <Text variant="small" tone="muted">
          {formatMoney(item.priceMinor)} c/u
        </Text>
        <View style={styles.controls}>
          <View style={styles.stepper}>
            <Pressable
              style={styles.step}
              onPress={() => (item.quantity <= 1 ? remove(item.productId) : setQuantity(item.productId, item.quantity - 1))}
              accessibilityLabel="Menos"
            >
              {item.quantity <= 1 ? <Trash2 size={15} color={colors.danger} /> : <Minus size={15} color={colors.foreground} />}
            </Pressable>
            <Text variant="bodyMedium" style={styles.qty}>
              {item.quantity}
            </Text>
            <Pressable
              style={styles.step}
              onPress={() => setQuantity(item.productId, item.quantity + 1)}
              disabled={item.quantity >= item.stock}
              accessibilityLabel="Más"
            >
              <Plus size={15} color={item.quantity >= item.stock ? colors.input : colors.foreground} />
            </Pressable>
          </View>
          <Text variant="bodyMedium">{formatMoney(item.priceMinor * item.quantity)}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 12 },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  line: { flexDirection: 'row', gap: 12 },
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.muted, overflow: 'hidden' },
  flex: { flex: 1, gap: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  step: { width: 36, height: 34, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 22, textAlign: 'center' },
});
