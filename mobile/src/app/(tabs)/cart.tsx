import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuthGate } from '@/components/blocks';
import { Price } from '@/components/Price';
import { PlatformTag } from '@/components/ProductCard';
import { ProductImage } from '@/components/ProductImage';
import { Button, Card, Checkbox, EmptyState, ErrorView, Loading, Notice, QuantityStepper } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { formatCny } from '@/lib/money';
import type { CartGroup } from '@/lib/types';

export default function CartScreen() {
  return (
    <AuthGate message="Connectez-vous pour retrouver votre panier.">
      <Cart />
    </AuthGate>
  );
}

function Cart() {
  const queryClient = useQueryClient();
  const cart = useQuery({ queryKey: ['cart'], queryFn: () => api<{ groups: CartGroup[]; count: number }>('/cart') });
  const [unselected, setUnselected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['cart'] });
    queryClient.invalidateQueries({ queryKey: ['me'] });
  };
  const update = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => api(`/cart/${id}`, { method: 'PATCH', body: { quantity } }),
    onMutate: () => setError(null),
    onSuccess: refresh,
    onError: (e) => setError(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/cart/${id}`, { method: 'DELETE' }),
    onMutate: () => setError(null),
    onSuccess: refresh,
    onError: (e) => setError(errorMessage(e)),
  });

  const groups = cart.data?.groups ?? [];
  const allItems = groups.flatMap((g) => g.items);
  const selectedIds = allItems.map((i) => i.id).filter((id) => !unselected.includes(id));
  const selectedTotal = useMemo(
    () => allItems.filter((i) => selectedIds.includes(i.id)).reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    [allItems, selectedIds],
  );
  const toggle = (ids: string[], select: boolean) => setUnselected((u) => (select ? u.filter((x) => !ids.includes(x)) : [...new Set([...u, ...ids])]));

  if (cart.isLoading) return <Loading />;
  if (cart.error) return <ErrorView message={errorMessage(cart.error)} onRetry={() => cart.refetch()} />;
  if (!groups.length)
    return (
      <EmptyState
        icon="cart-outline"
        title="Votre panier est vide"
        message="Cherchez un article ou collez un lien Taobao, 1688, Alibaba…"
        action={<Button title="Coller un lien" icon="link-outline" onPress={() => router.push('/link')} />}
      />
    );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.list} refreshControl={
          <RefreshControl
            refreshing={cart.isRefetching}
            onRefresh={() => {
              setError(null);
              cart.refetch();
            }}
          />
        }>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {groups.map((group) => {
          const ids = group.items.map((i) => i.id);
          const allSelected = ids.every((id) => selectedIds.includes(id));
          return (
            <Card key={group.key} style={styles.group}>
              <View style={styles.groupHeader}>
                <Checkbox checked={allSelected} onPress={() => toggle(ids, !allSelected)} />
                <PlatformTag platform={group.platform} />
                <Text style={styles.shop} numberOfLines={1}>
                  {group.shopName}
                </Text>
              </View>
              {group.items.map((item) => (
                <View key={item.id} style={styles.item}>
                  <Checkbox checked={selectedIds.includes(item.id)} onPress={() => toggle([item.id], !selectedIds.includes(item.id))} />
                  <Pressable
                    style={styles.thumb}
                    onPress={() => router.push({ pathname: '/product/[platform]/[itemId]', params: { platform: item.platform, itemId: item.itemId } })}>
                    <ProductImage uri={item.image} rounded={8} />
                  </Pressable>
                  <View style={styles.itemBody}>
                    <Text numberOfLines={2} style={styles.itemTitle}>
                      {item.title}
                    </Text>
                    {item.skuLabel ? <Text style={styles.sku}>{item.skuLabel}</Text> : null}
                    {item.remark ? <Text style={styles.remark}>📝 {item.remark}</Text> : null}
                    <View style={styles.itemFooter}>
                      <Price cny={item.unitPrice} size="sm" />
                      <QuantityStepper value={item.quantity} min={item.moq ?? 1} onChange={(quantity) => update.mutate({ id: item.id, quantity })} />
                    </View>
                  </View>
                  <Pressable onPress={() => remove.mutate(item.id)} hitSlop={8} accessibilityLabel="Supprimer">
                    <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
              <Text style={styles.groupFooter}>
                Port Chine {formatCny(group.domesticShipping)} · Frais de service {formatCny(group.serviceFee)}
              </Text>
            </Card>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <Checkbox checked={selectedIds.length === allItems.length} onPress={() => toggle(allItems.map((i) => i.id), selectedIds.length !== allItems.length)} label="Tout" />
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={styles.footerLabel}>Articles sélectionnés</Text>
          <Price cny={selectedTotal} size="sm" />
        </View>
        <Button
          title={`Commander (${selectedIds.length})`}
          disabled={!selectedIds.length}
          onPress={() => router.push({ pathname: '/checkout', params: { ids: selectedIds.join(',') } })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  group: { gap: spacing.md, padding: spacing.md },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shop: { flex: 1, fontWeight: '700', color: colors.text },
  item: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  thumb: { width: 76 },
  itemBody: { flex: 1, gap: 3 },
  itemTitle: { fontSize: 13, color: colors.text, lineHeight: 18 },
  sku: { fontSize: 12, color: colors.textSecondary },
  remark: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  groupFooter: { fontSize: 12, color: colors.textMuted, textAlign: 'right' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  footerLabel: { fontSize: 11, color: colors.textSecondary },
});
