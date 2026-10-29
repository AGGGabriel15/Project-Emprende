import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { BadgeCheck, Bike, Plus, Store } from 'lucide-react-native';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useCart } from '@/features/cart/store';
import {
  businessOpenState,
  type BusinessWithMeta,
  type DeliveryQuote,
  type Location,
  type ProductWithBusiness,
} from '@/features/catalog/meta';
import { formatMoney } from '@/lib/format';
import { TIER_INFO } from '@/lib/validations/business';
import type { Product } from '@/types/domain';
import { Text } from '~/components/ui/text';
import { toast } from '~/components/ui/toast';
import { useSession } from '~/features/auth/session';
import { colors, radius, shadow } from '~/theme/tokens';
import { CategoryIcon, OpenBadge, Rating } from './catalog-bits';

export function BusinessCard({
  business,
  location,
  delivery,
  width,
}: {
  business: BusinessWithMeta;
  location: Location;
  delivery: DeliveryQuote;
  width?: number;
}) {
  const router = useRouter();
  const state = businessOpenState(business);
  return (
    <Pressable
      onPress={() => router.push(`/negocios/${business.slug}`)}
      style={({ pressed }) => [styles.business, width ? { width } : null, pressed && styles.pressed]}
    >
      <View style={styles.cover}>
        {business.cover_url ? (
          <Image source={business.cover_url} style={[StyleSheet.absoluteFill, !state.open && styles.dimmed]} contentFit="cover" transition={200} />
        ) : null}
        <View style={styles.logo}>
          {business.logo_url ? (
            <Image source={business.logo_url} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <CategoryIcon icon={business.category?.icon} size={24} />
          )}
        </View>
      </View>
      <View style={styles.businessBody}>
        <View style={styles.row}>
          <Text variant="bodyMedium" numberOfLines={1} style={styles.flex}>
            {business.trade_name}
          </Text>
          <Rating value={business.rating_avg} count={business.rating_count} />
        </View>
        <View style={styles.tier}>
          <Text variant="small" tone="muted" numberOfLines={1}>
            {business.category?.name} ·
          </Text>
          <BadgeCheck size={13} color={colors.catarina} />
          <Text variant="small" tone="muted" numberOfLines={1} style={styles.flex}>
            {TIER_INFO[business.tier].label}
          </Text>
        </View>
        <OpenBadge state={state} />
        <View style={styles.pills}>
          <View style={[styles.pill, delivery ? styles.pillOn : null]}>
            <Bike size={13} color={delivery ? colors.catarina : colors.mutedForeground} />
            <Text variant="small" tone={delivery ? 'primary' : 'muted'}>
              {delivery ? `Delivery ${formatMoney(delivery.fee)}` : location ? 'Aún no llegamos a tu zona' : 'Delivery Catarina Market'}
            </Text>
          </View>
          {business.accepts_pickup && (
            <View style={styles.pill}>
              <Store size={13} color={colors.mutedForeground} />
              <Text variant="small" tone="muted">
                Retiro
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

type CardBusiness = Pick<BusinessWithMeta, 'id' | 'trade_name' | 'slug'> & { category?: { icon: string | null } | null };

/** Tarjeta de producto con botón para agregar al carrito (rebota y vibra). */
export function ProductCard({ product, business, closed }: { product: Product; business: CardBusiness; closed?: boolean }) {
  const router = useRouter();
  const { profile } = useSession();
  const add = useCart((s) => s.add);
  const bump = useSharedValue(1);
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.get() }] }));
  const soldOut = product.stock <= 0;
  const canShop = !profile || profile.role === 'customer';

  return (
    <Pressable onPress={() => router.push(`/productos/${product.id}`)} style={({ pressed }) => [styles.product, pressed && styles.pressed]}>
      <View style={styles.productImage}>
        {product.images[0] ? (
          <Image source={product.images[0]} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <CategoryIcon icon={business.category?.icon} size={32} color={colors.hojaClara} />
        )}
        {(soldOut || closed) && (
          <View style={styles.flag}>
            <Text variant="small" style={styles.flagText}>
              {soldOut ? 'Agotado' : 'Cerrado ahora'}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.productBody}>
        <Text variant="small" tone="muted" numberOfLines={1}>
          {business.trade_name}
        </Text>
        <Text variant="bodyMedium" numberOfLines={2} style={styles.productName}>
          {product.name}
        </Text>
        <View style={styles.row}>
          <Text variant="price" style={styles.flex}>
            {formatMoney(product.price_minor)}
          </Text>
          {canShop && !soldOut && (
            <Animated.View style={bumpStyle}>
              <Pressable
                accessibilityLabel={`Agregar ${product.name} al carrito`}
                hitSlop={8}
                onPress={() => {
                  add({
                    productId: product.id,
                    businessId: business.id,
                    businessName: business.trade_name,
                    businessSlug: business.slug,
                    name: product.name,
                    priceMinor: product.price_minor,
                    image: product.images[0],
                    stock: product.stock,
                  });
                  bump.set(withSequence(withSpring(1.3, { damping: 6, stiffness: 400 }), withSpring(1)));
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  toast.success('Agregado al carrito');
                }}
                style={styles.add}
              >
                <Plus size={18} color={colors.white} strokeWidth={2.6} />
              </Pressable>
            </Animated.View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/** Cuadrícula de 2 columnas; cada tarjeta entra con una animación escalonada. */
export function ProductGrid({ products }: { products: (Product & { business: ProductWithBusiness['business'] })[] }) {
  const { width } = useWindowDimensions();
  const itemWidth = (Math.min(width, 720) - 32 - 12) / 2;
  return (
    <View style={styles.grid}>
      {products.map((p, i) => (
        <Animated.View key={p.id} entering={FadeInDown.delay(Math.min(i, 8) * 50).springify().damping(18)} style={{ width: itemWidth }}>
          <ProductCard product={p} business={p.business} closed={!businessOpenState(p.business).open} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pressed: { opacity: 0.94, transform: [{ scale: 0.985 }] },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  business: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  cover: { height: 104, backgroundColor: colors.niebla },
  dimmed: { opacity: 0.7 },
  logo: {
    position: 'absolute',
    left: 14,
    bottom: -24,
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.card,
    backgroundColor: colors.card,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  businessBody: { paddingHorizontal: 14, paddingTop: 30, paddingBottom: 14, gap: 4 },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.muted,
  },
  pillOn: { backgroundColor: colors.niebla },
  product: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  productImage: { aspectRatio: 1, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  flag: { position: 'absolute', top: 8, left: 8, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 8, paddingVertical: 3 },
  flagText: { fontSize: 11, color: colors.foreground },
  productBody: { padding: 12, gap: 2 },
  productName: { minHeight: 44 },
  add: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.catarina,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
