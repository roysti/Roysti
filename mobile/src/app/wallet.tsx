import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { AuthGate } from '@/components/blocks';
import { Button, Card, Chip, ErrorView, Field, Loading, Notice } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/labels';
import { formatCny, useMoney } from '@/lib/money';
import type { Transaction } from '@/lib/types';

const PRESETS = [100, 300, 500, 1000, 2000];

export default function WalletScreen() {
  return (
    <AuthGate>
      <Wallet />
    </AuthGate>
  );
}

function Wallet() {
  const queryClient = useQueryClient();
  const { convert } = useMoney();
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: () => api<{ balance: number; transactions: Transaction[]; methods: string[] }>('/wallet') });
  const [amount, setAmount] = useState('300');
  const [method, setMethod] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const topup = useMutation({
    mutationFn: () => api('/wallet/topup', { body: { amount: Number(amount), method: method ?? wallet.data?.methods[0] ?? 'Carte bancaire' } }),
    onSuccess: () => {
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  if (wallet.isLoading) return <Loading />;
  if (wallet.error || !wallet.data) return <ErrorView message={errorMessage(wallet.error)} onRetry={() => wallet.refetch()} />;
  const selectedMethod = method ?? wallet.data.methods[0];

  return (
    <FlatList
      data={wallet.data.transactions}
      keyExtractor={(t) => t.id}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View style={{ gap: spacing.md }}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Solde disponible</Text>
            <Text style={styles.balance}>{formatCny(wallet.data.balance)}</Text>
            {convert(wallet.data.balance) ? <Text style={styles.balanceLabel}>≈ {convert(wallet.data.balance)}</Text> : null}
          </View>
          <Card style={{ gap: spacing.md }}>
            <Text style={styles.title}>Recharger</Text>
            <View style={styles.wrap}>
              {PRESETS.map((p) => (
                <Chip key={p} label={`¥${p}`} active={amount === String(p)} onPress={() => setAmount(String(p))} />
              ))}
            </View>
            <Field label="Montant (CNY)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            {convert(Number(amount) || 0) ? <Text style={styles.meta}>≈ {convert(Number(amount) || 0)}</Text> : null}
            <Text style={styles.meta}>Moyen de paiement</Text>
            <View style={styles.wrap}>
              {wallet.data.methods.map((m) => (
                <Chip key={m} label={m} active={selectedMethod === m} onPress={() => setMethod(m)} />
              ))}
            </View>
            <Notice tone="warning">Démo : la recharge est simulée. En production, elle passe par un prestataire de paiement (Stripe, PayPal, Mobile Money…) et n’est créditée qu’après confirmation.</Notice>
            {done ? <Notice tone="success">Solde rechargé.</Notice> : null}
            {topup.error ? <Notice tone="danger">{errorMessage(topup.error)}</Notice> : null}
            <Button title="Recharger" icon="add-circle-outline" onPress={() => topup.mutate()} loading={topup.isPending} disabled={!(Number(amount) > 0)} />
          </Card>
          <Text style={styles.title}>Historique</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.tx}>
          <View style={{ flex: 1 }}>
            <Text style={styles.txNote}>{item.note}</Text>
            <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>
          </View>
          <Text style={[styles.txAmount, { color: item.amount >= 0 ? colors.success : colors.text }]}>
            {item.amount >= 0 ? '+' : '−'}
            {formatCny(Math.abs(item.amount))}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
  balanceCard: { backgroundColor: colors.primary, borderRadius: 16, padding: spacing.xl, alignItems: 'center', gap: 4 },
  balanceLabel: { color: '#FFE3D6' },
  balance: { color: '#fff', fontSize: 32, fontWeight: '900' },
  title: { fontWeight: '800', fontSize: 15, color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  meta: { color: colors.textSecondary, fontSize: 12 },
  tx: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: spacing.md, borderRadius: 10, gap: spacing.md },
  txNote: { color: colors.text, fontSize: 13 },
  txAmount: { fontWeight: '800' },
});
