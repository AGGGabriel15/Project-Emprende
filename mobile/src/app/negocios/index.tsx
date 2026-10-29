import { Stack } from 'expo-router';
import { Search, Store } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BusinessCard } from '~/components/catalog/cards';
import { CategoryChips } from '~/components/catalog/catalog-bits';
import { EmptyState, Skeleton } from '~/components/ui/feedback';
import { useBusinesses, useCategories } from '~/features/catalog/queries';
import { useDelivery } from '~/features/location/use-delivery';
import { colors, fonts, radius } from '~/theme/tokens';

export default function BusinessesScreen() {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const categories = useCategories();
  const businesses = useBusinesses({ q, categoryId });
  const { location, delivery } = useDelivery();

  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 450);
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <>
      <Stack.Screen options={{ title: 'Negocios de Catarina' }} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={businesses.isRefetching} onRefresh={() => void businesses.refetch()} tintColor={colors.catarina} colors={[colors.catarina]} />}
      >
        <View style={styles.search}>
          <Search size={18} color={colors.mutedForeground} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Buscar negocio"
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
            returnKeyType="search"
          />
        </View>
        <View style={styles.bleed}>
          <CategoryChips categories={categories.data ?? []} active={categoryId} onChange={setCategoryId} />
        </View>
        {businesses.isLoading ? (
          <Skeleton height={220} />
        ) : businesses.data?.length ? (
          businesses.data.map((b, i) => (
            <Animated.View key={b.id} entering={FadeInDown.delay(Math.min(i, 6) * 60).springify().damping(18)}>
              <BusinessCard business={b} location={location} delivery={delivery} />
            </Animated.View>
          ))
        ) : (
          <EmptyState icon={Store} title="No encontramos negocios" description="Prueba otra búsqueda o categoría." />
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
  },
  input: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.foreground, height: '100%' },
  bleed: { marginHorizontal: -16 },
});
