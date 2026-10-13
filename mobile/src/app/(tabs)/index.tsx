import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DemoBanner, SearchBar } from '@/components/blocks';
import { ProductCard } from '@/components/ProductCard';
import { ErrorView, Loading, type IconName } from '@/components/ui';
import { colors, platformColors, radius, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { useMe, useMeta } from '@/lib/session';
import type { ProductSummary } from '@/lib/types';

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'link-outline', title: '1. Trouvez', text: 'Cherchez ou collez un lien' },
  { icon: 'bag-check-outline', title: '2. Achat', text: 'Nous commandons pour vous' },
  { icon: 'camera-outline', title: '3. Contrôle', text: 'Photos QC en entrepôt' },
  { icon: 'airplane-outline', title: '4. Envoi', text: 'Livraison internationale' },
];

const TOOLS: { icon: IconName; label: string; href: Parameters<typeof router.push>[0] }[] = [
  { icon: 'calculator-outline', label: 'Frais de port', href: '/estimate' },
  { icon: 'swap-horizontal-outline', label: 'Transfert', href: '/forwarding' },
  { icon: 'pricetags-outline', label: 'Coupons', href: '/coupons' },
  { icon: 'help-circle-outline', label: 'Aide', href: '/help' },
];

export default function HomeScreen() {
  const meta = useMeta();
  const me = useMe();
  const featured = useQuery({
    queryKey: ['featured'],
    queryFn: () => api<{ items: ProductSummary[]; isDemoData: boolean }>('/products/featured'),
  });

  const header = (
    <View>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.brand}>Roysti</Text>
            <Text style={styles.tagline}>Taobao, 1688, Alibaba… livrés chez vous</Text>
          </View>
          <Pressable onPress={() => router.push('/notifications')} style={styles.bell} accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            {me.data?.summary.unreadNotifications ? <View style={styles.dot} /> : null}
          </Pressable>
        </View>
        <SearchBar />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.platforms}>
          {(meta.data?.platforms ?? []).map((p) => (
            <Pressable
              key={p.id}
              onPress={() => router.push({ pathname: '/search', params: { platform: p.id } })}
              style={[styles.platform, { borderColor: platformColors[p.id] }]}>
              <Text style={[styles.platformText, { color: platformColors[p.id] }]}>{p.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {featured.data?.isDemoData ? <DemoBanner /> : null}

      <View style={styles.stepsCard}>
        {STEPS.map((s) => (
          <Pressable key={s.title} style={styles.stepItem} onPress={() => router.push('/help')}>
            <View style={styles.stepIcon}>
              <Ionicons name={s.icon} size={20} color={colors.primary} />
            </View>
            <Text style={styles.stepTitle}>{s.title}</Text>
            <Text style={styles.stepText}>{s.text}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.tools}>
        {TOOLS.map((t) => (
          <Pressable key={t.label} style={styles.tool} onPress={() => router.push(t.href)}>
            <Ionicons name={t.icon} size={22} color={colors.text} />
            <Text style={styles.toolText}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Catégories</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
        {(meta.data?.categories ?? []).map((c) => (
          <Pressable key={c.id} style={styles.category} onPress={() => router.push({ pathname: '/search', params: { category: c.id, title: c.name } })}>
            <Text style={styles.categoryIcon}>{c.icon}</Text>
            <Text style={styles.categoryText} numberOfLines={2}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Tendances</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={featured.data?.items ?? []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={featured.isRefetching} onRefresh={() => featured.refetch()} />}
        ListEmptyComponent={
          featured.isLoading ? <Loading /> : featured.error ? <ErrorView message={errorMessage(featured.error)} onRetry={() => featured.refetch()} /> : null
        }
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <ProductCard product={item} />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  list: { backgroundColor: colors.background, paddingBottom: spacing.xxl },
  hero: { backgroundColor: colors.primary, padding: spacing.lg, gap: spacing.md, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 0.5 },
  tagline: { color: '#FFE3D6', fontSize: 13, marginTop: 2 },
  bell: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFE14D' },
  platforms: { gap: spacing.sm },
  platform: { backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1 },
  platformText: { fontWeight: '800', fontSize: 13 },
  stepsCard: {
    flexDirection: 'row',
    margin: spacing.lg,
    marginBottom: 0,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontSize: 12, fontWeight: '800', color: colors.text },
  stepText: { fontSize: 10, color: colors.textSecondary, textAlign: 'center' },
  tools: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.sm },
  tool: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  toolText: { fontSize: 12, fontWeight: '600', color: colors.text },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: spacing.xl, marginBottom: spacing.sm, marginHorizontal: spacing.lg },
  categories: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  category: { width: 78, alignItems: 'center', gap: 4 },
  categoryIcon: { fontSize: 28, backgroundColor: colors.card, width: 58, height: 58, borderRadius: 29, textAlign: 'center', lineHeight: 58, overflow: 'hidden' },
  categoryText: { fontSize: 11, textAlign: 'center', color: colors.text },
  column: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  cell: { flex: 1, marginBottom: spacing.sm, maxWidth: '50%' },
});
