import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, BadgeCheck, Bike, MapPin, MessageCircle, Phone, ShoppingBag, Store } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DAY_NAMES, formatTime, localNow } from '@/features/businesses/hours';
import { businessOpenState } from '@/features/catalog/meta';
import { formatDate, formatMoney } from '@/lib/format';
import { formatPhone, phoneHref, whatsappHref } from '@/lib/phone';
import { TIER_INFO } from '@/lib/validations/business';
import { ProductGrid } from '~/components/catalog/cards';
import { CategoryIcon, OpenBadge, Rating } from '~/components/catalog/catalog-bits';
import { ReviewItem } from '~/components/catalog/review-item';
import { Badge } from '~/components/ui/badge';
import { IconButton } from '~/components/ui/button';
import { Card, Divider } from '~/components/ui/card';
import { EmptyState, Skeleton } from '~/components/ui/feedback';
import { Text } from '~/components/ui/text';
import { useBusiness } from '~/features/catalog/queries';
import { useMunicipalities } from '~/features/location/geo';
import { useDelivery } from '~/features/location/use-delivery';
import { colors, radius, shadow } from '~/theme/tokens';

export default function BusinessScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const query = useBusiness(slug);
  const { location, delivery } = useDelivery();
  const [section, setSection] = useState<string | null>(null);
  const towns = useMunicipalities(query.data?.business.department_id);

  const header = <Stack.Screen options={{ headerShown: false }} />;
  if (query.isLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 60, padding: 16, gap: 12 }]}>
        {header}
        <Skeleton height={160} />
        <Skeleton height={24} width="60%" />
        <Skeleton height={200} />
      </View>
    );
  }
  if (!query.data) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 60, padding: 16 }]}>
        {header}
        <EmptyState icon={Store} title="Negocio no disponible" description="Puede que ya no esté publicado." />
      </View>
    );
  }

  const { business, products, categories, reviews, stats } = query.data;
  const state = businessOpenState(business);
  const today = localNow().dow;
  const sections = categories.filter((c) => products.some((p) => p.category_id === c.id));
  const visible = section ? products.filter((p) => p.category_id === section) : products;
  const withBusiness = visible.map((p) => ({ ...p, business }));
  const town = towns.data?.find((m) => m.id === business.municipality_id)?.name;

  return (
    <View style={styles.root}>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.catarina} colors={[colors.catarina]} />}
      >
        <View style={styles.cover}>
          {business.cover_url && <Image source={business.cover_url} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />}
        </View>
        <View style={styles.head}>
          <View style={styles.logo}>
            {business.logo_url ? (
              <Image source={business.logo_url} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <CategoryIcon icon={business.category?.icon} size={34} />
            )}
          </View>
          <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.headText}>
            <Text variant="title">{business.trade_name}</Text>
            <View style={styles.meta}>
              <Rating value={business.rating_avg} count={business.rating_count} />
              <Text variant="small" tone="muted">
                · {business.category?.name}
              </Text>
            </View>
            <Badge tone={business.tier === 'informal' ? 'violet' : 'brand'} icon={BadgeCheck}>
              {TIER_INFO[business.tier].label}
            </Badge>
            <OpenBadge state={state} />
          </Animated.View>
        </View>

        <View style={styles.body}>
          {business.description ? (
            <Text variant="body" tone="muted">
              {business.description}
            </Text>
          ) : null}

          <View style={styles.stats}>
            <Stat value={String(stats.completedOrders)} label="pedidos completados" />
            <Stat value={stats.onTimeRate == null ? '—' : `${Math.round(stats.onTimeRate * 100)} %`} label="a tiempo" />
            <Stat value={stats.memberSince ? formatDate(stats.memberSince, false) : '—'} label="en Catarina Market" />
          </View>

          <Card style={styles.gap}>
            <Text variant="heading">Formas de entrega</Text>
            {business.accepts_pickup && (
              <Line icon={Store} title="Retiro en el local" text="Sin costo de envío. Entregas tu PIN al recogerlo." />
            )}
            <Line
              icon={Bike}
              title="Delivery Catarina Market"
              text={
                delivery
                  ? `${formatMoney(delivery.fee)} · ${delivery.days === 0 ? 'el mismo día' : `${delivery.days} ${delivery.days === 1 ? 'día' : 'días'}`}`
                  : location
                    ? 'Aún no llegamos a tu zona.'
                    : 'Elige tu ubicación en Inicio para ver la tarifa.'
              }
            />
            <Text variant="small" tone="muted">
              Recogemos el pedido en el negocio, lo revisamos y te lo entregamos con tu PIN. Tu pago se libera al negocio solo después de la
              entrega.
            </Text>
          </Card>

          <View>
            <Text variant="heading" style={styles.sectionTitle}>
              Productos
            </Text>
            {sections.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={styles.bleed}>
                {[{ id: null, name: 'Todo' }, ...sections].map((c) => (
                  <Pressable key={c.id ?? 'todo'} onPress={() => setSection(c.id)} style={[styles.tab, section === c.id && styles.tabActive]}>
                    <Text variant="smallMedium" tone={section === c.id ? 'white' : 'default'}>
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {withBusiness.length ? (
              <ProductGrid products={withBusiness} />
            ) : (
              <EmptyState icon={ShoppingBag} title="Este negocio aún no publica productos" />
            )}
          </View>

          {reviews.length > 0 && (
            <Card style={styles.gap}>
              <Text variant="heading">Reseñas de clientes</Text>
              {reviews.map((r, i) => (
                <View key={r.id} style={styles.gap}>
                  {i > 0 && <Divider />}
                  <ReviewItem review={r} />
                </View>
              ))}
            </Card>
          )}

          <Card style={styles.gap}>
            <Text variant="heading">Horario</Text>
            {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
              const hour = business.business_hours.find((h) => h.day_of_week === dow);
              const bold = dow === today;
              return (
                <View key={dow} style={styles.hourRow}>
                  <Text variant={bold ? 'smallMedium' : 'small'}>{DAY_NAMES[dow]}</Text>
                  <Text variant={bold ? 'smallMedium' : 'small'} tone={bold ? 'default' : 'muted'}>
                    {!hour || hour.is_closed ? 'Cerrado' : `${formatTime(hour.opens_at)} – ${formatTime(hour.closes_at)}`}
                  </Text>
                </View>
              );
            })}
            {business.business_closures.slice(0, 3).map((c) => (
              <View key={c.date} style={styles.closure}>
                <Badge tone="amber">Cerrado {formatDate(`${c.date}T12:00:00`, false)}</Badge>
                {c.reason ? (
                  <Text variant="small" tone="muted">
                    {c.reason}
                  </Text>
                ) : null}
              </View>
            ))}
          </Card>

          <Card style={styles.gap}>
            {business.address_line ? (
              <Line icon={MapPin} title={business.address_line} text={town ?? ''} />
            ) : null}
            {business.phone ? (
              <Pressable onPress={() => Linking.openURL(phoneHref(business.phone!))}>
                <Line icon={Phone} title={formatPhone(business.phone)} text="Llamar" />
              </Pressable>
            ) : null}
            {business.whatsapp ? (
              <Pressable onPress={() => Linking.openURL(whatsappHref(business.whatsapp!))}>
                <Line icon={MessageCircle} title="Escribir por WhatsApp" text={formatPhone(business.whatsapp)} />
              </Pressable>
            ) : null}
          </Card>
        </View>
      </ScrollView>
      <View style={[styles.back, { top: insets.top + 8 }]}>
        <IconButton icon={ArrowLeft} label="Volver" tone="glass" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="heading" tone="primary">
        {value}
      </Text>
      <Text variant="small" tone="muted" style={styles.center}>
        {label}
      </Text>
    </View>
  );
}

function Line({ icon: Icon, title, text }: { icon: typeof Store; title: string; text: string }) {
  return (
    <View style={styles.line}>
      <Icon size={18} color={colors.catarina} />
      <View style={styles.flex}>
        <Text variant="bodyMedium">{title}</Text>
        {text ? (
          <Text variant="small" tone="muted">
            {text}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  cover: { height: 210, backgroundColor: colors.niebla },
  head: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, marginTop: -44, alignItems: 'flex-end' },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: colors.card,
    backgroundColor: colors.card,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  headText: { flex: 1, gap: 4, paddingTop: 52 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  body: { padding: 16, gap: 18 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 10 },
  center: { textAlign: 'center' },
  gap: { gap: 10 },
  line: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  flex: { flex: 1 },
  sectionTitle: { marginBottom: 10 },
  bleed: { marginHorizontal: -16, marginBottom: 12 },
  tabs: { gap: 8, paddingHorizontal: 16 },
  tab: { borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.catarina, borderColor: colors.catarina },
  hourRow: { flexDirection: 'row', justifyContent: 'space-between' },
  closure: { gap: 4 },
  back: { position: 'absolute', left: 12 },
});
