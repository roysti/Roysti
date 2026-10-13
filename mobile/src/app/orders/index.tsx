import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuthGate } from '@/components/blocks';
import { PlatformTag } from '@/components/ProductCard';
import { ProductImage } from '@/components/ProductImage';
import { Badge, Button, Card, Chip, EmptyState, ErrorView, Loading, Notice } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { ORDER_STATUS, formatDate } from '@/lib/labels';
import { formatCny } from '@/lib/money';
import type { Order, OrderStatus } from '@/lib/types';

const FILTERS: { id: string; label: string; statuses?: OrderStatus[] }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'pending_payment', label: 'À payer', statuses: ['pending_payment'] },
  { id: 'in_progress', label: 'En cours', statuses: ['paid', 'purchased', 'shipped_domestic', 'awaiting_arrival'] },
  { id: 'in_warehouse', label: 'En entrepôt', statuses: ['in_warehouse'] },
  { id: 'canceled', label: 'Annulées', statuses: ['canceled'] },
];

export default function OrdersScreen() {
  return (
    <AuthGate>
      <Orders />
    </AuthGate>
  );
}

function Orders() {
  const params = useLocalSearchParams<{ status?: string; paid?: string }>();
  const [filter, setFilter] = useState(params.status ?? 'all');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const orders = useQuery({ queryKey: ['orders'], queryFn: () => api<Order[]>('/orders') });
  const pay = useMutation({
    mutationFn: (id: string) => api('/orders/pay', { body: { orderIds: [id] } }),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (e) => setError(errorMessage(e)),
  });

  const statuses = FILTERS.find((f) => f.id === filter)?.statuses;
  const list = (orders.data ?? []).filter((o) => !statuses || statuses.includes(o.status));

  return (
    <View style={{ flex: 1 }}>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => (
            <Chip key={f.id} label={f.label} active={filter === f.id} onPress={() => setFilter(f.id)} />
          ))}
        </ScrollView>
      </View>
      {orders.isLoading ? (
        <Loading />
      ) : orders.error ? (
        <ErrorView message={errorMessage(orders.error)} onRetry={() => orders.refetch()} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => orders.refetch()} />}
          ListHeaderComponent={
            <View style={{ gap: spacing.sm }}>
              {params.paid ? <Notice tone="success">Paiement reçu ! Nos acheteurs passent commande auprès des vendeurs.</Notice> : null}
              {error ? <Notice tone="danger">{error}</Notice> : null}
            </View>
          }
          ListEmptyComponent={<EmptyState icon="receipt-outline" title="Aucune commande" message="Vos commandes apparaîtront ici." />}
          renderItem={({ item }) => {
            const tone = ORDER_STATUS[item.status];
            const first = item.items[0];
            return (
              <Pressable onPress={() => router.push({ pathname: '/orders/[id]', params: { id: item.id } })}>
                <Card style={styles.card}>
                  <View style={styles.row}>
                    <PlatformTag platform={item.platform} />
                    <Text style={styles.shop} numberOfLines={1}>
                      {item.shopName}
                    </Text>
                    <Badge label={tone.label} color={tone.color} background={tone.background} />
                  </View>
                  {first ? (
                    <View style={styles.row}>
                      <View style={{ width: 56 }}>
                        <ProductImage uri={first.image} rounded={6} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={2} style={styles.title}>
                          {first.title}
                        </Text>
                        <Text style={styles.meta}>
                          {item.items.length > 1 ? `+ ${item.items.length - 1} autre(s) article(s)` : first.skuLabel}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  <View style={styles.row}>
                    <Text style={styles.meta}>
                      {item.number} · {formatDate(item.createdAt)}
                    </Text>
                    <Text style={styles.total}>{formatCny(item.total)}</Text>
                  </View>
                  {item.status === 'pending_payment' ? (
                    <Button small title="Payer maintenant" onPress={() => pay.mutate(item.id)} loading={pay.isPending && pay.variables === item.id} />
                  ) : null}
                </Card>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { gap: spacing.sm, padding: spacing.md },
  list: { padding: spacing.md, paddingTop: 0, gap: spacing.md, paddingBottom: spacing.xxl },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'space-between' },
  shop: { flex: 1, fontWeight: '700', color: colors.text },
  title: { fontSize: 13, color: colors.text },
  meta: { fontSize: 12, color: colors.textSecondary },
  total: { fontWeight: '800', color: colors.primary },
});
