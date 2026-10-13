import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Steps, Timeline } from '@/components/blocks';
import { PlatformTag } from '@/components/ProductCard';
import { ProductImage } from '@/components/ProductImage';
import { Badge, Button, Card, Divider, ErrorView, Loading, Notice, Row } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { ORDER_STATUS, ORDER_STEPS } from '@/lib/labels';
import { formatCny } from '@/lib/money';
import { useMeta } from '@/lib/session';
import type { Order } from '@/lib/types';

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const meta = useMeta();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const order = useQuery({ queryKey: ['order', id], queryFn: () => api<Order>(`/orders/${id}`) });

  const action = useMutation({
    mutationFn: (kind: 'pay' | 'cancel' | 'advance') =>
      kind === 'pay'
        ? api('/orders/pay', { body: { orderIds: [id] } })
        : kind === 'cancel'
          ? api(`/orders/${id}/cancel`, { method: 'POST' })
          : api(`/demo/orders/${id}/advance`, { method: 'POST' }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  if (order.isLoading) return <Loading />;
  if (order.error || !order.data) return <ErrorView message={errorMessage(order.error)} onRetry={() => order.refetch()} />;
  const o = order.data;
  const tone = ORDER_STATUS[o.status];
  const canAdvance = meta.data?.demoMode && ['paid', 'purchased', 'shipped_domestic', 'awaiting_arrival'].includes(o.status);
  const steps = o.type === 'forwarding' ? [{ status: 'awaiting_arrival' as const, label: 'Déclaré' }, { status: 'in_warehouse' as const, label: 'Entrepôt' }] : ORDER_STEPS;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: o.number }} />
      <Card style={{ gap: spacing.md }}>
        <View style={styles.row}>
          <Badge label={tone.label} color={tone.color} background={tone.background} />
          <Text style={styles.meta}>{o.type === 'forwarding' ? 'Transfert de colis' : 'Achat'}</Text>
        </View>
        <Steps steps={steps} current={o.status} canceled={o.status === 'canceled'} />
        {o.domesticTracking ? <Row label="Suivi Chine" value={o.domesticTracking} /> : null}
      </Card>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Card style={{ gap: spacing.md }}>
        <View style={styles.row}>
          <PlatformTag platform={o.platform} />
          <Text style={styles.shop}>{o.shopName}</Text>
        </View>
        {o.items.map((item) => (
          <View key={item.id} style={styles.item}>
            <View style={{ width: 64 }}>
              <ProductImage uri={item.image} rounded={8} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>{item.skuLabel}</Text>
              {item.remark ? <Text style={styles.meta}>📝 {item.remark}</Text> : null}
              {item.services.length ? (
                <Text style={styles.meta}>Services : {item.services.map((s) => meta.data?.valueAddedServices.find((v) => v.id === s)?.name ?? s).join(', ')}</Text>
              ) : null}
              <Text style={styles.price}>
                {item.quantity} × {formatCny(item.unitPrice)}
              </Text>
              {item.sourceUrl ? (
                <Pressable onPress={() => Linking.openURL(item.sourceUrl)}>
                  <Text style={styles.link}>Annonce d’origine ›</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <Row label="Articles" value={formatCny(o.itemsTotal)} />
        <Row label="Port intérieur Chine" value={formatCny(o.domesticShipping)} />
        <Row label="Frais de service" value={formatCny(o.serviceFee)} />
        {o.servicesTotal ? <Row label="Services QC" value={formatCny(o.servicesTotal)} /> : null}
        {o.discount ? <Row label={`Remise ${o.couponCode ?? ''}`} value={`− ${formatCny(o.discount)}`} /> : null}
        <Divider />
        <Row label="Total" value={formatCny(o.total)} strong />
      </Card>

      <View style={styles.actions}>
        {o.status === 'pending_payment' ? <Button title="Payer" icon="card-outline" onPress={() => action.mutate('pay')} loading={action.isPending} /> : null}
        {o.status === 'in_warehouse' ? <Button title="Voir en entrepôt" icon="cube-outline" onPress={() => router.push('/warehouse')} /> : null}
        {['pending_payment', 'paid', 'awaiting_arrival'].includes(o.status) ? (
          <Button
            title="Annuler la commande"
            variant="danger"
            onPress={() => confirm('Annuler la commande ?', o.status === 'paid' ? 'Le montant sera remboursé sur votre solde.' : 'Cette action est définitive.', () => action.mutate('cancel'))}
          />
        ) : null}
        {canAdvance ? (
          <Button title="Démo : simuler l’étape suivante" variant="ghost" icon="flask-outline" onPress={() => action.mutate('advance')} loading={action.isPending} />
        ) : null}
      </View>

      <Card>
        <Text style={styles.cardTitle}>Historique</Text>
        <Timeline events={o.events} labels={ORDER_STATUS} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  shop: { flex: 1, fontWeight: '700', color: colors.text },
  item: { flexDirection: 'row', gap: spacing.md },
  title: { fontSize: 14, color: colors.text, fontWeight: '600' },
  meta: { fontSize: 12, color: colors.textSecondary },
  price: { fontWeight: '700', color: colors.text },
  link: { color: colors.info, fontSize: 12, fontWeight: '600' },
  actions: { gap: spacing.sm },
  cardTitle: { fontWeight: '800', color: colors.text, marginBottom: spacing.md },
});
