import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Minus, PackageX, Plus, ShoppingBag } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/features/cart/store';
import { businessOpenState } from '@/features/catalog/meta';
import { formatMoney } from '@/lib/format';
import { CategoryIcon, OpenBadge } from '~/components/catalog/catalog-bits';
import { Button, IconButton } from '~/components/ui/button';
import { Card, InfoRow } from '~/components/ui/card';
import { EmptyState, Skeleton } from '~/components/ui/feedback';
import { Text } from '~/components/ui/text';
import { toast } from '~/components/ui/toast';
import { useSession } from '~/features/auth/session';
import { useProduct } from '~/features/catalog/queries';
import { colors, radius } from '~/theme/tokens';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile } = useSession();
  const query = useProduct(id);
  const add = useCart((s) => s.add);
  const inCart = useCart((s) => s.items.find((i) => i.productId === id)?.quantity ?? 0);
  const [quantity, setQuantity] = useState(1);
  const [page, setPage] = useState(0);

  const header = <Stack.Screen options={{ headerShown: false }} />;
  if (query.isLoading) {
    return (
      <View style={[styles.root, { padding: 16, paddingTop: insets.top + 60, gap: 12 }]}>
        {header}
        <Skeleton height={width - 32} />
        <Skeleton height={28} width="70%" />
      </View>
    );
  }
  const product = query.data;
  if (!product) {
    return (
      <View style={[styles.root, { padding: 16, paddingTop: insets.top + 60 }]}>
        {header}
        <EmptyState icon={PackageX} title="Producto no disponible" action={<Button onPress={() => router.back()}>Volver</Button>} />
      </View>
    );
  }

  const state = businessOpenState(product.business);
  const soldOut = product.stock <= 0;
  const canShop = !profile || profile.role === 'customer';
  const max = Math.max(1, Math.min(99, product.stock - inCart));
  const images = product.images.length ? product.images : [null];

  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {images.map((src, i) => (
            <View key={src ?? i} style={[styles.photo, { width, height: width }]}>
              {src ? (
                <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              ) : (
                <CategoryIcon icon={product.business.category?.icon} size={64} color={colors.hojaClara} />
              )}
            </View>
          ))}
        </ScrollView>
        {images.length > 1 && (
          <View style={styles.dots}>
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>
        )}

        <View style={styles.body}>
          <Pressable onPress={() => router.push(`/negocios/${product.business.slug}`)}>
            <Text variant="smallMedium" tone="primary">
              {product.business.trade_name} →
            </Text>
          </Pressable>
          <Text variant="title">{product.name}</Text>
          <Text variant="title" tone="primary">
            {formatMoney(product.price_minor)}
          </Text>
          <OpenBadge state={state} />
          <Text variant="small" tone={soldOut ? 'danger' : 'muted'}>
            {soldOut ? 'Agotado' : product.stock <= 5 ? `¡Solo quedan ${product.stock}!` : `${product.stock} disponibles`}
          </Text>
          {product.description ? <Text variant="body">{product.description}</Text> : null}
          {(product.material || product.dimensions || product.weight_grams || product.category) && (
            <Card>
              {product.category && <InfoRow label="Sección" value={product.category.name} />}
              {product.material && <InfoRow label="Material" value={product.material} />}
              {product.dimensions && <InfoRow label="Medidas" value={product.dimensions} />}
              {product.weight_grams ? <InfoRow label="Peso" value={`${product.weight_grams} g`} /> : null}
            </Card>
          )}
          {!state.open && (
            <Text variant="small" tone="muted">
              Puedes agregarlo al carrito; el pago se habilita cuando el negocio abra.
            </Text>
          )}
        </View>
      </ScrollView>

      {canShop && !soldOut && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.stepper}>
            <Pressable style={styles.step} onPress={() => setQuantity((q) => Math.max(1, q - 1))} accessibilityLabel="Menos">
              <Minus size={18} color={colors.foreground} />
            </Pressable>
            <Text variant="heading" style={styles.qty}>
              {quantity}
            </Text>
            <Pressable style={styles.step} onPress={() => setQuantity((q) => Math.min(max, q + 1))} accessibilityLabel="Más">
              <Plus size={18} color={colors.foreground} />
            </Pressable>
          </View>
          <Button
            icon={ShoppingBag}
            style={styles.flex}
            block
            onPress={() => {
              add(
                {
                  productId: product.id,
                  businessId: product.business.id,
                  businessName: product.business.trade_name,
                  businessSlug: product.business.slug,
                  name: product.name,
                  priceMinor: product.price_minor,
                  image: product.images[0],
                  stock: product.stock,
                },
                quantity,
              );
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              toast.success(`${quantity} × ${product.name} en tu carrito`);
              setQuantity(1);
            }}
          >
            Agregar · {formatMoney(product.price_minor * quantity)}
          </Button>
        </View>
      )}
      <View style={[styles.back, { top: insets.top + 8 }]}>
        <IconButton icon={ArrowLeft} label="Volver" tone="glass" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  photo: { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 18, backgroundColor: colors.catarina },
  body: { padding: 16, gap: 8 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  step: { width: 42, height: 46, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 24, textAlign: 'center' },
  flex: { flex: 1 },
  back: { position: 'absolute', left: 12 },
});
