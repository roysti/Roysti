import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DemoBanner, SearchBar } from '@/components/blocks';
import { ProductCard } from '@/components/ProductCard';
import { Chip, EmptyState, ErrorView, Loading } from '@/components/ui';
import { colors, platformColors, radius, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { useMeta } from '@/lib/session';
import type { Platform, SearchResult, SortOrder } from '@/lib/types';

const SORTS: { id: SortOrder; label: string }[] = [
  { id: 'default', label: 'Pertinence' },
  { id: 'sales', label: 'Ventes' },
  { id: 'price_asc', label: 'Prix ↑' },
  { id: 'price_desc', label: 'Prix ↓' },
];

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string; platform?: Platform; category?: string; title?: string }>();
  const meta = useMeta();
  const [q, setQ] = useState(params.q ?? '');
  const [platform, setPlatform] = useState<Platform | undefined>(params.platform);
  const [category, setCategory] = useState<string | undefined>(params.category);
  const [sort, setSort] = useState<SortOrder>('default');
  const [showFilters, setShowFilters] = useState(false);
  // Saisie du filtre de prix ; appliqué seulement à la validation (chaque recherche peut être facturée).
  const [minDraft, setMinDraft] = useState('');
  const [maxDraft, setMaxDraft] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const applyPrices = () => {
    setMinPrice(minDraft.trim());
    setMaxPrice(maxDraft.trim());
  };

  const query = useInfiniteQuery({
    queryKey: ['search', q, platform, category, sort, minPrice, maxPrice],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<SearchResult>('/products/search', {
        query: { q, platform, category, sort, page: pageParam, pageSize: 20, minPrice: Number(minPrice) || undefined, maxPrice: Number(maxPrice) || undefined },
      }),
    // Chaque page coûte un appel au fournisseur : on s'arrête dès qu'une page n'apporte rien de nouveau.
    getNextPageParam: (last, pages) => {
      if (!last.hasMore || !last.items.length) return undefined;
      const earlier = new Set(pages.slice(0, -1).flatMap((p) => p.items.map((i) => i.id)));
      return last.items.some((i) => !earlier.has(i.id)) ? last.page + 1 : undefined;
    },
  });

  // Les plateformes renvoient parfois le même article sur deux pages : on ne le garde qu'une fois.
  const items = useMemo(() => {
    const seen = new Set<string>();
    return (query.data?.pages.flatMap((p) => p.items) ?? []).filter((i) => !seen.has(i.id) && seen.add(i.id));
  }, [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;
  const isDemo = query.data?.pages[0]?.isDemoData;
  const sentQuery = query.data?.pages[0]?.query;
  const categoryName = meta.data?.categories.find((c) => c.id === category)?.name;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: q ? `« ${q} »` : (categoryName ?? params.title ?? 'Recherche') }} />
      <View style={styles.header}>
        <SearchBar initial={q} onSubmit={setQ} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Toutes" active={!platform} onPress={() => setPlatform(undefined)} />
          {(meta.data?.platforms ?? []).map((p) => (
            <Chip key={p.id} label={p.name} active={platform === p.id} color={platformColors[p.id]} onPress={() => setPlatform(platform === p.id ? undefined : p.id)} />
          ))}
        </ScrollView>
        <View style={styles.sortRow}>
          {SORTS.map((s) => (
            <Pressable key={s.id} onPress={() => setSort(s.id)}>
              <Text style={[styles.sort, sort === s.id && styles.sortActive]}>{s.label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowFilters((v) => !v)} style={styles.filterBtn}>
            <Ionicons name="options-outline" size={16} color={showFilters ? colors.primary : colors.textSecondary} />
            <Text style={[styles.sort, showFilters && styles.sortActive]}>Filtres</Text>
          </Pressable>
        </View>
        {showFilters ? (
          <View style={styles.filters}>
            <Text style={styles.filterLabel}>Prix (¥)</Text>
            <TextInput
              value={minDraft}
              onChangeText={setMinDraft}
              onSubmitEditing={applyPrices}
              onBlur={applyPrices}
              returnKeyType="search"
              keyboardType="numeric"
              placeholder="Min"
              style={styles.priceInput}
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.filterLabel}>–</Text>
            <TextInput
              value={maxDraft}
              onChangeText={setMaxDraft}
              onSubmitEditing={applyPrices}
              onBlur={applyPrices}
              returnKeyType="search"
              keyboardType="numeric"
              placeholder="Max"
              style={styles.priceInput}
              placeholderTextColor={colors.textMuted}
            />
            {minDraft.trim() !== minPrice || maxDraft.trim() !== maxPrice ? <Chip label="Appliquer" active onPress={applyPrices} /> : null}
            {category ? <Chip label={`${categoryName ?? category} ✕`} active onPress={() => setCategory(undefined)} /> : null}
          </View>
        ) : null}
      </View>
      {isDemo ? <DemoBanner /> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.list}
        onEndReachedThreshold={0.4}
        onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
        ListHeaderComponent={
          items.length ? (
            <Text style={styles.count}>
              {total.toLocaleString('fr-FR')} résultat(s)
              {sentQuery && !isDemo ? ` · recherché en chinois : ${sentQuery}` : ''}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          query.isLoading ? (
            <Loading label="Recherche sur les plateformes…" />
          ) : query.error ? (
            <ErrorView message={errorMessage(query.error)} onRetry={() => query.refetch()} />
          ) : (
            <EmptyState
              icon="search-outline"
              title="Aucun résultat"
              message={
                minPrice || maxPrice
                  ? 'Aucun article dans cette fourchette de prix parmi les premiers résultats : élargissez-la ou retirez le filtre.'
                  : 'Essayez d’autres mots-clés (en français ou en chinois) ou collez directement un lien.'
              }
            />
          )
        }
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={{ margin: spacing.lg }} /> : null}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <ProductCard product={item} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.card, padding: spacing.md, gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  chips: { gap: spacing.sm },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  sort: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  sortActive: { color: colors.primary, fontWeight: '800' },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  filters: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  filterLabel: { color: colors.textSecondary, fontSize: 13 },
  priceInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6, width: 80, color: colors.text },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  count: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  column: { gap: spacing.sm },
  cell: { flex: 1, marginBottom: spacing.sm, maxWidth: '50%' },
});
