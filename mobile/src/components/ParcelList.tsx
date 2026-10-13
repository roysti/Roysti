import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { PARCEL_STATUS, formatDate } from '@/lib/labels';
import { formatCny } from '@/lib/money';
import type { Parcel } from '@/lib/types';
import { Badge, Card, EmptyState, ErrorView, Loading } from './ui';

export function ParcelList() {
  const parcels = useQuery({ queryKey: ['parcels'], queryFn: () => api<Parcel[]>('/parcels') });
  if (parcels.isLoading) return <Loading />;
  if (parcels.error) return <ErrorView message={errorMessage(parcels.error)} onRetry={() => parcels.refetch()} />;
  return (
    <FlatList
      data={parcels.data ?? []}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={parcels.isRefetching} onRefresh={() => parcels.refetch()} />}
      ListEmptyComponent={
        <EmptyState icon="airplane-outline" title="Aucun colis" message="Quand vos articles sont en entrepôt, regroupez-les dans un colis pour les expédier." />
      }
      renderItem={({ item }) => {
        const tone = PARCEL_STATUS[item.status];
        return (
          <Pressable onPress={() => router.push({ pathname: '/parcels/[id]', params: { id: item.id } })}>
            <Card style={styles.card}>
              <View style={styles.row}>
                <Ionicons name="cube" size={20} color={colors.primary} />
                <Text style={styles.number}>{item.number}</Text>
                <Badge label={tone.label} color={tone.color} background={tone.background} />
              </View>
              <Text style={styles.meta}>
                {item.lineName} · {item.itemIds.length} article(s) · {item.actualWeightKg ?? item.estimatedWeightKg} kg · {item.address.city} ({item.address.country})
              </Text>
              <View style={styles.row}>
                <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>
                <Text style={styles.total}>{formatCny(item.total)}</Text>
              </View>
              {item.trackingNumber ? <Text style={styles.tracking}>Suivi : {item.trackingNumber}</Text> : null}
            </Card>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.md },
  card: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'space-between' },
  number: { flex: 1, fontWeight: '800', color: colors.text },
  meta: { color: colors.textSecondary, fontSize: 12 },
  total: { fontWeight: '800', color: colors.primary },
  tracking: { color: colors.info, fontWeight: '600', fontSize: 12 },
});
