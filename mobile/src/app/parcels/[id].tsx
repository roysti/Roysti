import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Steps, Timeline } from '@/components/blocks';
import { PhotoViewer } from '@/components/PhotoViewer';
import { ProductImage } from '@/components/ProductImage';
import { Badge, Button, Card, Divider, ErrorView, Loading, Notice, Row } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { PARCEL_STATUS, PARCEL_STEPS } from '@/lib/labels';
import { formatCny } from '@/lib/money';
import { useMeta } from '@/lib/session';
import type { Parcel } from '@/lib/types';

export default function ParcelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const meta = useMeta();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[] | null>(null);
  const parcel = useQuery({ queryKey: ['parcel', id], queryFn: () => api<Parcel>(`/parcels/${id}`) });

  const action = useMutation({
    mutationFn: (kind: 'pay' | 'cancel' | 'advance') =>
      api(kind === 'advance' ? `/demo/parcels/${id}/advance` : `/parcels/${id}/${kind}`, { method: 'POST' }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  if (parcel.isLoading) return <Loading />;
  if (parcel.error || !parcel.data) return <ErrorView message={errorMessage(parcel.error)} onRetry={() => parcel.refetch()} />;
  const p = parcel.data;
  const tone = PARCEL_STATUS[p.status];
  const stepStatus = p.status === 'packed' ? 'packing' : p.status;
  const canAdvance = meta.data?.demoMode && ['paid', 'packing', 'packed', 'shipped'].includes(p.status);
  const serviceNames = p.services.map((s) => meta.data?.valueAddedServices.find((v) => v.id === s)?.name ?? s);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: p.number }} />
      <Card style={{ gap: spacing.md }}>
        <View style={styles.row}>
          <Badge label={tone.label} color={tone.color} background={tone.background} />
          <Text style={styles.meta}>{p.lineName}</Text>
        </View>
        <Steps steps={PARCEL_STEPS} current={stepStatus} canceled={p.status === 'canceled'} />
        {p.trackingNumber ? <Row label="Numéro de suivi" value={p.trackingNumber} /> : null}
      </Card>

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {p.adjustment ? (
        <Notice tone={p.adjustment < 0 ? 'success' : 'warning'}>
          Poids réel {p.actualWeightKg} kg (estimé {p.estimatedWeightKg} kg) :{' '}
          {p.adjustment < 0 ? `${formatCny(-p.adjustment)} remboursés sur votre solde.` : `${formatCny(p.adjustment)} prélevés en complément.`}
        </Notice>
      ) : null}

      <Card style={{ gap: spacing.xs }}>
        <Text style={styles.cardTitle}>Livraison</Text>
        <Text style={styles.text}>
          {p.address.fullName} · {p.address.phone}
        </Text>
        <Text style={styles.meta}>
          {p.address.line1}
          {p.address.line2 ? `, ${p.address.line2}` : ''}, {p.address.postalCode} {p.address.city}, {p.address.country}
        </Text>
        <Divider />
        <Row label="Poids estimé" value={`${p.estimatedWeightKg} kg`} />
        {p.actualWeightKg ? <Row label="Poids réel" value={`${p.actualWeightKg} kg`} /> : null}
        <Row label="Poids facturé" value={`${p.quote.chargeableWeightKg} kg`} />
        <Row label="Dimensions" value={`${p.dimensions.lengthCm} × ${p.dimensions.widthCm} × ${p.dimensions.heightCm} cm`} />
        <Row label="Délai annoncé" value={`${p.quote.deliveryDays[0]}–${p.quote.deliveryDays[1]} jours`} />
        {serviceNames.length ? <Row label="Services" value={serviceNames.join(', ')} /> : null}
        <Row label="Assurance" value={p.insured ? `Oui (valeur ${formatCny(p.declaredValue)})` : 'Non'} />
      </Card>

      {p.packingPhotos.length ? (
        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.cardTitle}>Photos d’emballage</Text>
          <Pressable style={styles.photos} onPress={() => setPhotos(p.packingPhotos)}>
            {p.packingPhotos.map((uri) => (
              <View key={uri} style={{ width: 70 }}>
                <ProductImage uri={uri} rounded={6} />
              </View>
            ))}
          </Pressable>
        </Card>
      ) : null}

      <Card style={{ gap: spacing.sm }}>
        <Text style={styles.cardTitle}>Contenu ({p.items?.length ?? p.itemIds.length})</Text>
        {p.items?.map((item) => (
          <Pressable key={item.id} style={styles.item} onPress={() => setPhotos(item.qcPhotos)}>
            <View style={{ width: 48 }}>
              <ProductImage uri={item.image} rounded={6} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.text}>
                {item.title}
              </Text>
              <Text style={styles.meta}>
                ×{item.quantity} · {item.weightKg} kg · {formatCny(item.value)}
              </Text>
            </View>
          </Pressable>
        ))}
      </Card>

      <Card>
        <Row label="Fret" value={formatCny(p.quote.freight)} />
        {p.quote.fuelSurcharge ? <Row label="Surcharge carburant" value={formatCny(p.quote.fuelSurcharge)} /> : null}
        <Row label="Manutention" value={formatCny(p.quote.handlingFee)} />
        {p.quote.insurance ? <Row label="Assurance" value={formatCny(p.quote.insurance)} /> : null}
        {p.servicesTotal ? <Row label="Services d’emballage" value={formatCny(p.servicesTotal)} /> : null}
        {p.storageFee ? <Row label="Stockage prolongé" value={formatCny(p.storageFee)} /> : null}
        {p.discount ? <Row label="Remise" value={`− ${formatCny(p.discount)}`} /> : null}
        <Divider />
        <Row label="Total payé" value={formatCny(p.total)} strong />
      </Card>

      <View style={{ gap: spacing.sm }}>
        {p.status === 'pending_payment' ? <Button title={`Payer ${formatCny(p.total)}`} onPress={() => action.mutate('pay')} loading={action.isPending} /> : null}
        {['pending_payment', 'paid'].includes(p.status) ? (
          <Button
            title="Annuler le colis"
            variant="danger"
            onPress={() => confirm('Annuler le colis ?', 'Les articles retournent dans votre entrepôt' + (p.status === 'paid' ? ' et le port est remboursé.' : '.'), () => action.mutate('cancel'))}
          />
        ) : null}
        {canAdvance ? <Button title="Démo : simuler l’étape suivante" variant="ghost" icon="flask-outline" onPress={() => action.mutate('advance')} loading={action.isPending} /> : null}
      </View>

      <Card>
        <Text style={[styles.cardTitle, { marginBottom: spacing.md }]}>Suivi</Text>
        <Timeline events={p.events} labels={PARCEL_STATUS} />
      </Card>
      <PhotoViewer photos={photos} onClose={() => setPhotos(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontWeight: '800', color: colors.text, fontSize: 15 },
  text: { color: colors.text, fontWeight: '600' },
  meta: { color: colors.textSecondary, fontSize: 12 },
  photos: { flexDirection: 'row', gap: spacing.sm },
  item: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
});
