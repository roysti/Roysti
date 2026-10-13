import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlatformTag } from '@/components/ProductCard';
import { ProductImage } from '@/components/ProductImage';
import { Button, Card, Divider, ErrorView, Field, Loading, Notice, Row } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { ApiError, api, errorMessage } from '@/lib/api';
import { formatCny, useMoney } from '@/lib/money';
import { useMe, useMeta } from '@/lib/session';
import type { CartGroup, Order } from '@/lib/types';

export default function CheckoutScreen() {
  const { ids = '' } = useLocalSearchParams<{ ids: string }>();
  const selected = ids.split(',').filter(Boolean);
  const queryClient = useQueryClient();
  const me = useMe();
  const meta = useMeta();
  const { convert } = useMoney();
  const cart = useQuery({ queryKey: ['cart'], queryFn: () => api<{ groups: CartGroup[] }>('/cart') });
  const [coupon, setCoupon] = useState('');
  const [error, setError] = useState<{ text: string; lowBalance?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  if (cart.isLoading) return <Loading />;
  if (cart.error) return <ErrorView message={errorMessage(cart.error)} />;

  const groups = (cart.data?.groups ?? [])
    .map((g) => ({ ...g, items: g.items.filter((i) => selected.includes(i.id)) }))
    .filter((g) => g.items.length);
  // Même calcul que le serveur (qui fait foi) : une commande par vendeur, port = le plus élevé du vendeur.
  const servicePrice = (id: string) => meta.data?.valueAddedServices.find((v) => v.id === id)?.price ?? 0;
  const totals = groups.reduce(
    (acc, g) => {
      const items = g.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      acc.items += items;
      acc.domestic += Math.max(0, ...g.items.map((i) => i.domesticShipping));
      acc.fee += items * (meta.data?.fees.serviceFeeRate[g.platform] ?? 0);
      acc.services += g.items.reduce((s, i) => s + i.services.reduce((a, id) => a + servicePrice(id), 0), 0);
      return acc;
    },
    { items: 0, domestic: 0, fee: 0, services: 0 },
  );
  const total = totals.items + totals.domestic + totals.fee + totals.services;
  const balance = me.data?.user.balance ?? 0;

  const pay = async () => {
    setLoading(true);
    setError(null);
    let orders: Order[] = [];
    try {
      orders = await api<Order[]>('/orders/checkout', { body: { cartItemIds: selected, couponCode: coupon.trim() || undefined } });
      await api('/orders/pay', { body: { orderIds: orders.map((o) => o.id) } });
      await queryClient.invalidateQueries();
      router.replace({ pathname: '/orders', params: { paid: '1' } });
    } catch (e) {
      await queryClient.invalidateQueries();
      if (orders.length) {
        // Commandes créées mais non payées : elles restent payables depuis « Mes commandes ».
        router.replace({ pathname: '/orders', params: { status: 'pending_payment' } });
        return;
      }
      setError({ text: errorMessage(e), lowBalance: e instanceof ApiError && e.code === 'insufficient_balance' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.list}>
        {groups.map((g) => (
          <Card key={g.key} style={{ gap: spacing.sm }}>
            <View style={styles.groupHeader}>
              <PlatformTag platform={g.platform} />
              <Text style={styles.shop}>{g.shopName}</Text>
            </View>
            {g.items.map((i) => (
              <View key={i.id} style={styles.item}>
                <View style={{ width: 54 }}>
                  <ProductImage uri={i.image} rounded={6} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.title}>
                    {i.title}
                  </Text>
                  <Text style={styles.sku}>{i.skuLabel || '—'}</Text>
                </View>
                <Text style={styles.qty}>
                  {i.quantity} × {formatCny(i.unitPrice)}
                </Text>
              </View>
            ))}
          </Card>
        ))}

        <Card style={{ gap: spacing.sm }}>
          <Field label="Code promo" value={coupon} onChangeText={setCoupon} placeholder="Ex. : BIENVENUE" autoCapitalize="characters" />
          <Divider />
          <Row label="Articles" value={formatCny(totals.items)} />
          <Row label="Port intérieur Chine" value={formatCny(totals.domestic)} />
          <Row label="Frais de service" value={formatCny(totals.fee)} />
          {totals.services ? <Row label="Services QC" value={formatCny(totals.services)} /> : null}
          <Divider />
          <Row label="Total (hors remise)" value={formatCny(total)} strong />
          {convert(total) ? <Row label="Soit environ" value={convert(total)!} muted /> : null}
          <Row label="Solde disponible" value={formatCny(balance)} />
        </Card>
        <Notice>Nous achetons les articles dès réception du paiement. Vous serez notifié à chaque étape : achat, expédition du vendeur, arrivée en entrepôt avec photos.</Notice>
        {error ? <Notice tone="danger">{error.text}</Notice> : null}
        {error?.lowBalance ? <Button title="Recharger mon solde" variant="secondary" icon="wallet-outline" onPress={() => router.push('/wallet')} /> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button title={`Payer ${formatCny(total)}`} icon="lock-closed-outline" onPress={pay} loading={loading} disabled={!groups.length} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, gap: spacing.md },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shop: { fontWeight: '700', color: colors.text, flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 13, color: colors.text },
  sku: { fontSize: 12, color: colors.textSecondary },
  qty: { fontSize: 13, fontWeight: '700', color: colors.text },
  footer: { padding: spacing.md, backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
