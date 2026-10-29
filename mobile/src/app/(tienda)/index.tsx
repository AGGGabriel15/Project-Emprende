import { BlurTargetView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowRight, Store } from 'lucide-react-native';
import { useRef, type ComponentRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassPanel } from '~/components/brand/glass-panel';
import { Logo } from '~/components/brand/logo';
import { PatternBackground } from '~/components/brand/pattern';
import { BusinessCard, ProductGrid } from '~/components/catalog/cards';
import { CategoryChips } from '~/components/catalog/catalog-bits';
import { LocationChip } from '~/components/catalog/location-chip';
import { Button } from '~/components/ui/button';
import { SectionTitle } from '~/components/ui/card';
import { EmptyState, Skeleton } from '~/components/ui/feedback';
import { Text } from '~/components/ui/text';
import { useBusinesses, useCategories, useProductSearch } from '~/features/catalog/queries';
import { useDelivery } from '~/features/location/use-delivery';
import { colors, radius } from '~/theme/tokens';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const photo = useRef<ComponentRef<typeof View>>(null);
  const categories = useCategories();
  const businesses = useBusinesses({ limit: 12 });
  const featured = useProductSearch({ limit: 8 });
  const { location, delivery } = useDelivery();
  const refreshing = businesses.isRefetching || featured.isRefetching;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            businesses.refetch();
            featured.refetch();
          }}
          tintColor={colors.white}
          colors={[colors.catarina]}
          progressViewOffset={insets.top}
        />
      }
    >
      {/* Portada: el Mirador de Catarina con panel de vidrio */}
      <View style={[styles.hero, { paddingTop: insets.top + 10 }]}>
        <BlurTargetView ref={photo} style={StyleSheet.absoluteFill}>
          <Image
            source={require('~assets/images/mirador-catarina.jpg')}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition={{ top: '62%', left: '50%' }}
            accessibilityLabel="La Laguna de Apoyo vista desde el Mirador de Catarina"
          />
          <LinearGradient
            colors={['rgba(14,59,39,0.6)', 'rgba(14,59,39,0.25)', 'rgba(14,59,39,0.75)']}
            style={StyleSheet.absoluteFill}
          />
        </BlurTargetView>
        <View style={styles.topBar}>
          <Logo tone="negative" height={34} />
          <LocationChip tone="glass" />
        </View>
        <Animated.View entering={FadeInDown.delay(150).springify().damping(18)}>
          <GlassPanel target={photo} style={styles.glass}>
            <Text variant="eyebrow" style={{ color: colors.hojaClara }}>
              Catarina, Masaya · el balcón de los pueblos
            </Text>
            <Text variant="hero" tone="white">
              Artesanías, plantas y flores directo de quienes las hacen
            </Text>
            <Text variant="body" style={styles.heroText}>
              Compra a los viveros y talleres de Catarina. Cada negocio prepara tu pedido y te lo envía o lo retiras en el local.
            </Text>
            <View style={styles.heroActions}>
              <Button iconRight={ArrowRight} onPress={() => router.push('/buscar')}>
                Explorar productos
              </Button>
              <Button variant="glass" onPress={() => router.push('/vendedor/solicitud')}>
                Vender en Catarina
              </Button>
            </View>
          </GlassPanel>
        </Animated.View>
        <Text
          variant="small"
          style={styles.credit}
          onPress={() => WebBrowser.openBrowserAsync('https://commons.wikimedia.org/wiki/File:Laguna_de_Apoyo.jpg')}
        >
          Mirador de Catarina · Foto: Jesús Jiménez, CC BY-SA 2.0 (editada)
        </Text>
      </View>

      <View style={styles.sectionPad}>
        <CategoryChips categories={categories.data ?? []} onChange={(id) => router.push({ pathname: '/buscar', params: id ? { categoria: String(id) } : {} })} />
      </View>

      <View style={styles.section}>
        <View style={styles.padded}>
          <SectionTitle title="Negocios de Catarina" action={<SeeAll onPress={() => router.push('/negocios')} />} />
        </View>
        {businesses.isLoading ? (
          <View style={styles.padded}>
            <Skeleton height={210} />
          </View>
        ) : businesses.data?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel} snapToInterval={Math.min(width * 0.78, 320) + 12} decelerationRate="fast">
            {businesses.data.map((b, i) => (
              <Animated.View key={b.id} entering={FadeInDown.delay(80 * i).springify().damping(18)}>
                <BusinessCard business={b} location={location} delivery={delivery} width={Math.min(width * 0.78, 320)} />
              </Animated.View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.padded}>
            <EmptyState
              icon={Store}
              title="Aún no hay negocios publicados"
              description="Los negocios aparecen aquí cuando la administración aprueba su solicitud."
              action={<Button onPress={() => router.push('/vendedor/solicitud')}>Registrar mi negocio</Button>}
            />
          </View>
        )}
      </View>

      {(featured.data?.products.length ?? 0) > 0 && (
        <View style={[styles.section, styles.padded]}>
          <SectionTitle title="Recién llegados" action={<SeeAll onPress={() => router.push('/buscar')} />} />
          <ProductGrid products={featured.data!.products} />
        </View>
      )}

      <View style={[styles.section, styles.padded]}>
        <View style={styles.cta}>
          <PatternBackground variant="green" />
          <View style={styles.ctaContent}>
            <Text variant="title" tone="white">
              ¿Tienes un vivero o taller en Catarina?
            </Text>
            <Text variant="body" style={styles.heroText}>
              Publica tu catálogo, recibe pedidos en tiempo real y cobra en línea. Sin mensualidad: solo una comisión cuando vendes.
            </Text>
            <Button variant="white" onPress={() => router.push('/vendedor/solicitud')} style={styles.ctaButton}>
              Quiero vender
            </Button>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function SeeAll({ onPress }: { onPress: () => void }) {
  return (
    <Text variant="smallMedium" tone="primary" onPress={onPress} suppressHighlighting>
      Ver todo →
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 32 },
  hero: { paddingHorizontal: 16, paddingBottom: 30, overflow: 'hidden', backgroundColor: colors.bosque },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 28 },
  glass: { marginBottom: 6 },
  heroText: { color: 'rgba(255,255,255,0.88)' },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  credit: { position: 'absolute', right: 10, bottom: 6, fontSize: 9, color: 'rgba(255,255,255,0.6)' },
  sectionPad: { marginTop: 18 },
  section: { marginTop: 28 },
  padded: { paddingHorizontal: 16 },
  carousel: { gap: 12, paddingHorizontal: 16, paddingBottom: 6 },
  cta: { borderRadius: radius.xl, overflow: 'hidden' },
  ctaContent: { padding: 22, gap: 10, zIndex: 1 },
  ctaButton: { alignSelf: 'flex-start', marginTop: 6 },
});
