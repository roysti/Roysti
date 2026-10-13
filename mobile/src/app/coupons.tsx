import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { AuthGate } from '@/components/blocks';
import { Badge, Button, Card, EmptyState, ErrorView, Loading } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { formatCny } from '@/lib/money';
import type { Coupon } from '@/lib/types';

export default function CouponsScreen() {
  return (
    <AuthGate>
      <Coupons />
    </AuthGate>
  );
}

function Coupons() {
  const coupons = useQuery({ queryKey: ['coupons'], queryFn: () => api<Coupon[]>('/coupons') });
  const [copied, setCopied] = useState<string | null>(null);
  if (coupons.isLoading) return <Loading />;
  if (coupons.error) return <ErrorView message={errorMessage(coupons.error)} onRetry={() => coupons.refetch()} />;
  return (
    <FlatList
      data={coupons.data ?? []}
      keyExtractor={(c) => c.code}
      contentContainerStyle={styles.container}
      ListEmptyComponent={<EmptyState icon="pricetags-outline" title="Aucun coupon" />}
      renderItem={({ item }) => {
        const inactive = item.used || item.expired;
        return (
          <Card style={[styles.card, inactive && { opacity: 0.5 }]}>
            <View style={styles.amount}>
              <Text style={styles.amountText}>{formatCny(item.amount)}</Text>
              <Text style={styles.scope}>{item.appliesTo === 'order' ? 'Commande' : 'Expédition'}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.code}>{item.code}</Text>
              <Text style={styles.meta}>{item.description}</Text>
              <Text style={styles.meta}>Dès {formatCny(item.minSpend)} · expire le {new Date(item.expiresAt).toLocaleDateString('fr-FR')}</Text>
              {inactive ? (
                <Badge label={item.used ? 'Utilisé' : 'Expiré'} color={colors.textMuted} background={colors.background} />
              ) : (
                <Button
                  small
                  variant="secondary"
                  title={copied === item.code ? 'Copié ✔' : 'Copier le code'}
                  style={{ alignSelf: 'flex-start' }}
                  onPress={async () => {
                    await Clipboard.setStringAsync(item.code);
                    setCopied(item.code);
                  }}
                />
              )}
            </View>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md },
  card: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  amount: { width: 86, height: 86, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  amountText: { color: colors.primary, fontWeight: '900', fontSize: 18 },
  scope: { color: colors.primaryDark, fontSize: 11, fontWeight: '600' },
  code: { fontWeight: '900', color: colors.text, letterSpacing: 1 },
  meta: { color: colors.textSecondary, fontSize: 12 },
});
