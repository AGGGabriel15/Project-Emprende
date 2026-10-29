import { useLocalSearchParams } from 'expo-router';
import { PackageSearch, Search, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProductGrid } from '~/components/catalog/cards';
import { CategoryChips } from '~/components/catalog/catalog-bits';
import { EmptyState, Skeleton } from '~/components/ui/feedback';
import { Text } from '~/components/ui/text';
import { useCategories, useProductSearch, type ProductSort } from '~/features/catalog/queries';
import { colors, fonts, radius } from '~/theme/tokens';

const SORTS: { value: ProductSort; label: string }[] = [
  { value: 'recent', label: 'Recientes' },
  { value: 'price_asc', label: 'Menor precio' },
  { value: 'price_desc', label: 'Mayor precio' },
];

export default function SearchScreen() {
  const params = useLocalSearchParams<{ categoria?: string; q?: string }>();
  const [text, setText] = useState(params.q ?? '');
  const [q, setQ] = useState(params.q ?? '');
  const [categoryId, setCategoryId] = useState<number | undefined>(params.categoria ? Number(params.categoria) : undefined);
  const [sort, setSort] = useState<ProductSort>('recent');
  const [openNow, setOpenNow] = useState(false);
  const categories = useCategories();
  const results = useProductSearch({ q, categoryId, sort, openNow });

  // Al llegar desde una categoría de Inicio (la pestaña puede seguir montada).
  const [lastParam, setLastParam] = useState(params.categoria);
  if (params.categoria !== lastParam) {
    setLastParam(params.categoria);
    if (params.categoria) setCategoryId(Number(params.categoria));
  }

  // Busca medio segundo después de dejar de escribir.
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 450);
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.header}>
        <Text variant="title">Explorar</Text>
        <View style={styles.search}>
          <Search size={18} color={colors.mutedForeground} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Macetas, orquídeas, cerámica…"
            placeholderTextColor={colors.mutedForeground}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => setQ(text.trim())}
            autoCorrect={false}
          />
          {text ? (
            <Pressable hitSlop={8} onPress={() => setText('')} accessibilityLabel="Borrar búsqueda">
              <X size={18} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={results.isRefetching} onRefresh={() => void results.refetch()} tintColor={colors.catarina} colors={[colors.catarina]} />}
      >
        <View style={styles.bleed}>
          <CategoryChips categories={categories.data ?? []} active={categoryId} onChange={setCategoryId} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={styles.bleed}>
          {SORTS.map((s) => (
            <Filter key={s.value} label={s.label} active={sort === s.value} onPress={() => setSort(s.value)} />
          ))}
          <Filter label="Abiertos ahora" active={openNow} onPress={() => setOpenNow((v) => !v)} />
        </ScrollView>
        {results.isLoading ? (
          <View style={styles.loading}>
            <Skeleton height={220} width="48%" />
            <Skeleton height={220} width="48%" />
          </View>
        ) : results.data?.products.length ? (
          <>
            <Text variant="small" tone="muted">
              {results.data.total} {results.data.total === 1 ? 'producto' : 'productos'}
            </Text>
            <ProductGrid products={results.data.products} />
          </>
        ) : (
          <EmptyState icon={PackageSearch} title="Sin resultados" description="Prueba con otra palabra o quita los filtros." />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Filter({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.filter, active && styles.filterActive]} accessibilityState={{ selected: active }}>
      <Text variant="small" tone={active ? 'primary' : 'muted'} style={active ? styles.filterTextActive : null}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 },
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
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.foreground, height: '100%' },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 14 },
  bleed: { marginHorizontal: -16 },
  filters: { gap: 8, paddingHorizontal: 16 },
  filter: { borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.muted },
  filterActive: { backgroundColor: colors.niebla, borderWidth: 1, borderColor: colors.hojaClara },
  filterTextActive: { fontFamily: fonts.sansMedium },
  loading: { flexDirection: 'row', justifyContent: 'space-between' },
});
