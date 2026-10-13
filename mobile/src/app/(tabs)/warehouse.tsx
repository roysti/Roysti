import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AuthGate } from '@/components/blocks';
import { ParcelList } from '@/components/ParcelList';
import { PhotoViewer } from '@/components/PhotoViewer';
import { ProductImage } from '@/components/ProductImage';
import { Badge, Button, Card, Checkbox, Chip, EmptyState, ErrorView, Loading, Notice } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { formatCny } from '@/lib/money';
import { useMeta } from '@/lib/session';
import type { WarehouseItem } from '@/lib/types';

export default function WarehouseScreen() {
  const [tab, setTab] = useState<'stock' | 'parcels'>('stock');
  return (
    <AuthGate message="Connectez-vous pour voir vos articles en entrepôt et vos colis.">
      <View style={styles.tabs}>
        <Chip label="En stock" active={tab === 'stock'} onPress={() => setTab('stock')} />
        <Chip label="Mes colis" active={tab === 'parcels'} onPress={() => setTab('parcels')} />
      </View>
      {tab === 'stock' ? <Stock /> : <ParcelList />}
    </AuthGate>
  );
}

function Stock() {
  const queryClient = useQueryClient();
  const meta = useMeta();
  const items = useQuery({ queryKey: ['warehouse'], queryFn: () => api<WarehouseItem[]>('/warehouse') });
  const [selected, setSelected] = useState<string[]>([]);
  const [viewer, setViewer] = useState<WarehouseItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['warehouse'] });
    queryClient.invalidateQueries({ queryKey: ['me'] });
    queryClient.invalidateQueries({ queryKey: ['wallet'] });
  };
  const photos = useMutation({ mutationFn: (id: string) => api(`/warehouse/${id}/photos`, { method: 'POST' }), onSuccess: refresh, onError: (e) => setError(errorMessage(e)) });
  const returnItem = useMutation({
    mutationFn: (id: string) => api(`/warehouse/${id}/return`, { body: { reason: 'Non conforme aux photos / à la description' } }),
    onSuccess: refresh,
    onError: (e) => setError(errorMessage(e)),
  });

  if (items.isLoading) return <Loading />;
  if (items.error) return <ErrorView message={errorMessage(items.error)} onRetry={() => items.refetch()} />;
  const stored = (items.data ?? []).filter((i) => i.status === 'stored');
  const totalWeight = stored.filter((i) => selected.includes(i.id)).reduce((s, i) => s + i.weightKg, 0);
  const extraPhotoPrice = meta.data?.valueAddedServices.find((s) => s.id === 'extra_photos')?.price ?? 0;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items.data ?? []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={items.isRefetching} onRefresh={() => items.refetch()} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm }}>
            <Notice>
              Stockage gratuit {meta.data?.storage.freeDays ?? 90} jours. Vérifiez les photos QC puis regroupez vos articles dans un colis pour économiser sur le port.
            </Notice>
            {error ? <Notice tone="danger">{error}</Notice> : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState icon="cube-outline" title="Entrepôt vide" message="Vos articles apparaîtront ici dès leur arrivée, avec leurs photos de contrôle qualité." />
        }
        renderItem={({ item }) => {
          const isStored = item.status === 'stored';
          return (
            <Card style={styles.card}>
              <View style={styles.row}>
                {isStored ? (
                  <Checkbox checked={selected.includes(item.id)} onPress={() => setSelected((s) => (s.includes(item.id) ? s.filter((x) => x !== item.id) : [...s, item.id]))} />
                ) : null}
                <View style={{ width: 64 }}>
                  <ProductImage uri={item.image} rounded={8} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={2} style={styles.title}>
                    {item.title}
                  </Text>
                  <Text style={styles.meta}>{item.skuLabel || '—'} · ×{item.quantity}</Text>
                  <Text style={styles.meta}>
                    {item.weightKg} kg · valeur {formatCny(item.value)}
                    {item.sensitive ? ' · sensible' : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.row}>
                {isStored ? (
                  <Badge
                    label={item.storage.freeDaysLeft ? `${item.storage.freeDaysLeft} j de stockage gratuit` : `Stockage payant : ${formatCny(item.storage.storageFee)}`}
                    color={item.storage.freeDaysLeft > 15 ? colors.success : colors.warning}
                    background={item.storage.freeDaysLeft > 15 ? colors.successSoft : colors.warningSoft}
                  />
                ) : (
                  <Badge
                    label={item.status === 'in_parcel' ? 'Dans un colis' : item.status === 'return_requested' ? 'Retour demandé' : item.status}
                    color={colors.info}
                    background={colors.infoSoft}
                  />
                )}
                <Text style={styles.meta}>Cmd {item.orderNumber}</Text>
              </View>
              <Pressable style={styles.photos} onPress={() => setViewer(item)}>
                {item.qcPhotos.slice(0, 4).map((uri) => (
                  <View key={uri} style={styles.photo}>
                    <ProductImage uri={uri} rounded={6} />
                  </View>
                ))}
                <Text style={styles.photoCount}>{item.qcPhotos.length} photos QC ›</Text>
              </Pressable>
              {isStored ? (
                <View style={styles.actions}>
                  <Button small variant="ghost" icon="camera-outline" title={`+3 photos (${formatCny(extraPhotoPrice)})`} onPress={() => photos.mutate(item.id)} />
                  <Button
                    small
                    variant="danger"
                    icon="return-down-back-outline"
                    title="Retour"
                    onPress={() => confirm('Retourner au vendeur ?', 'Le remboursement est effectué après réception par le vendeur (frais de retour éventuels).', () => returnItem.mutate(item.id))}
                  />
                </View>
              ) : null}
              {item.parcelId ? (
                <Button small variant="secondary" title="Voir le colis" onPress={() => router.push({ pathname: '/parcels/[id]', params: { id: item.parcelId! } })} />
              ) : null}
            </Card>
          );
        }}
      />
      {stored.length ? (
        <View style={styles.footer}>
          <Checkbox
            checked={selected.length === stored.length}
            onPress={() => setSelected(selected.length === stored.length ? [] : stored.map((i) => i.id))}
            label="Tout"
          />
          <Text style={styles.footerText}>
            {selected.length} article(s){'\n'}
            {totalWeight.toFixed(2)} kg
          </Text>
          <Button
            title="Créer un colis"
            icon="airplane-outline"
            disabled={!selected.length}
            onPress={() => router.push({ pathname: '/parcels/new', params: { ids: selected.join(',') } })}
          />
        </View>
      ) : null}
      <PhotoViewer photos={viewer?.qcPhotos ?? null} title={viewer?.title} onClose={() => setViewer(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, paddingBottom: 0 },
  list: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  card: { gap: spacing.sm, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'space-between' },
  title: { fontSize: 13, color: colors.text, fontWeight: '600' },
  meta: { fontSize: 12, color: colors.textSecondary },
  photos: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  photo: { width: 48 },
  photoCount: { marginLeft: 'auto', color: colors.info, fontWeight: '700', fontSize: 12 },
  actions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  footerText: { flex: 1, color: colors.textSecondary, fontSize: 12, textAlign: 'right' },
});
