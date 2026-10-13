import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, platformColors, radius, spacing } from '@/constants/theme';
import { PLATFORM_NAMES } from '@/lib/labels';
import type { ProductSummary } from '@/lib/types';
import { Price } from './Price';
import { ProductImage } from './ProductImage';

export function PlatformTag({ platform }: { platform: ProductSummary['platform'] | 'other' }) {
  return (
    <View style={[styles.tag, { backgroundColor: platformColors[platform] }]}>
      <Text style={styles.tagText}>{PLATFORM_NAMES[platform]}</Text>
    </View>
  );
}

export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      onPress={() => router.push({ pathname: '/product/[platform]/[itemId]', params: { platform: product.platform, itemId: product.itemId } })}>
      <View>
        <ProductImage uri={product.image} rounded={0} />
        <View style={styles.tagWrap}>
          <PlatformTag platform={product.platform} />
        </View>
      </View>
      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.title}>
          {product.title}
        </Text>
        <Price cny={product.price} size="sm" />
        <View style={styles.meta}>
          {product.sales ? <Text style={styles.metaText}>{product.sales.toLocaleString('fr-FR')} ventes</Text> : <View />}
          {product.moq && product.moq > 1 ? <Text style={styles.moq}>Min. {product.moq}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tagWrap: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.sm, alignSelf: 'flex-start' },
  tagText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  body: { padding: spacing.sm, gap: 4 },
  title: { fontSize: 13, color: colors.text, lineHeight: 18, minHeight: 36 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText: { fontSize: 11, color: colors.textMuted },
  moq: { fontSize: 11, color: colors.warning, fontWeight: '700' },
});
