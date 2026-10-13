import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Checkbox, Divider, EmptyState, ErrorView, Field, Loading, Notice, Row } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { ApiError, api, errorMessage } from '@/lib/api';
import { formatCny, useMoney } from '@/lib/money';
import { useMeta } from '@/lib/session';
import type { Address, Parcel, ParcelQuote } from '@/lib/types';

export default function NewParcelScreen() {
  const { ids = '' } = useLocalSearchParams<{ ids: string }>();
  const itemIds = ids.split(',').filter(Boolean);
  const meta = useMeta();
  const queryClient = useQueryClient();
  const { convert } = useMoney();

  const addresses = useQuery({ queryKey: ['addresses'], queryFn: () => api<Address[]>('/addresses') });
  const [addressId, setAddressId] = useState<string | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [insured, setInsured] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [lineId, setLineId] = useState<string | null>(null);
  const [coupon, setCoupon] = useState('');
  const [error, setError] = useState<{ text: string; lowBalance?: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Une fois le colis créé, ses articles ne sont plus « en stock » : on cesse de recalculer le devis.
  const [created, setCreated] = useState(false);

  const address = addresses.data?.find((a) => a.id === addressId) ?? addresses.data?.find((a) => a.isDefault) ?? addresses.data?.[0];

  const quote = useQuery({
    queryKey: ['parcel-quote', ids, address?.country, services, insured, sensitive],
    queryFn: () => api<ParcelQuote>('/parcels/quote', { body: { itemIds, country: address!.country, services, insured, sensitive } }),
    enabled: !!address && itemIds.length > 0 && !created,
  });

  const firstAvailable = quote.data?.quotes.find((q) => q.available)?.lineId ?? null;
  const selectedLine = quote.data?.quotes.find((q) => q.lineId === lineId && q.available) ?? quote.data?.quotes.find((q) => q.lineId === firstAvailable);
  const parcelServices = meta.data?.valueAddedServices.filter((s) => s.scope === 'parcel') ?? [];
  const total = selectedLine && quote.data ? selectedLine.total + quote.data.servicesTotal + quote.data.storageFee : 0;

  const submit = async () => {
    if (!address || !selectedLine) return;
    setSubmitting(true);
    setError(null);
    let parcel: Parcel | null = null;
    try {
      parcel = await api<Parcel>('/parcels', {
        body: { itemIds, addressId: address.id, lineId: selectedLine.lineId, services, insured, sensitive, couponCode: coupon.trim() || undefined },
      });
      setCreated(true);
      await api(`/parcels/${parcel.id}/pay`, { method: 'POST' });
      await queryClient.invalidateQueries();
      router.replace({ pathname: '/parcels/[id]', params: { id: parcel.id } });
    } catch (e) {
      await queryClient.invalidateQueries();
      if (parcel) {
        router.replace({ pathname: '/parcels/[id]', params: { id: parcel.id } });
        return;
      }
      setError({ text: errorMessage(e), lowBalance: e instanceof ApiError && e.code === 'insufficient_balance' });
    } finally {
      setSubmitting(false);
    }
  };

  if (addresses.isLoading) return <Loading />;
  if (addresses.error) return <ErrorView message={errorMessage(addresses.error)} />;
  if (!addresses.data?.length)
    return (
      <EmptyState
        icon="location-outline"
        title="Ajoutez une adresse"
        message="Une adresse de livraison est nécessaire pour calculer les frais de port."
        action={<Button title="Ajouter une adresse" onPress={() => router.push('/addresses')} />}
      />
    );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.cardTitle}>Adresse de livraison</Text>
          {addresses.data.map((a) => (
            <Pressable key={a.id} style={[styles.option, a.id === address?.id && styles.optionActive]} onPress={() => setAddressId(a.id)}>
              <Ionicons name={a.id === address?.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>
                  {a.fullName} · {a.phone}
                </Text>
                <Text style={styles.meta}>
                  {a.line1}, {a.postalCode} {a.city}, {a.country}
                </Text>
              </View>
            </Pressable>
          ))}
          <Button small variant="ghost" title="Gérer mes adresses" onPress={() => router.push('/addresses')} />
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.cardTitle}>Emballage et services</Text>
          {parcelServices.map((s) => (
            <View key={s.id} style={styles.serviceRow}>
              <View style={{ flex: 1 }}>
                <Checkbox checked={services.includes(s.id)} onPress={() => setServices((l) => (l.includes(s.id) ? l.filter((x) => x !== s.id) : [...l, s.id]))} label={s.name} />
                <Text style={[styles.meta, { marginLeft: 30 }]}>{s.description}</Text>
              </View>
              <Text style={styles.price}>{s.price ? formatCny(s.price) : 'Gratuit'}</Text>
            </View>
          ))}
          <Divider />
          <View style={styles.serviceRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>Assurance</Text>
              <Text style={styles.meta}>
                {Math.round((meta.data?.insurance.rate ?? 0) * 100)} % de la valeur déclarée (min. {formatCny(meta.data?.insurance.min ?? 0)}) – perte ou casse.
              </Text>
            </View>
            <Switch value={insured} onValueChange={setInsured} trackColor={{ true: colors.primary }} />
          </View>
          <View style={styles.serviceRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>Contient batterie / liquide / poudre</Text>
              <Text style={styles.meta}>Limite le choix aux lignes acceptant les articles sensibles.</Text>
            </View>
            <Switch value={sensitive || !!quote.data?.sensitive} onValueChange={setSensitive} trackColor={{ true: colors.primary }} />
          </View>
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.cardTitle}>Ligne d’expédition</Text>
          {quote.data ? (
            <Text style={styles.meta}>
              Poids estimé {quote.data.estimate.weightKg} kg · carton ≈ {quote.data.estimate.dimensions.lengthCm} cm de côté · valeur déclarée {formatCny(quote.data.declaredValue)}
            </Text>
          ) : null}
          {quote.isLoading ? <Loading /> : null}
          {quote.error ? <Notice tone="danger">{errorMessage(quote.error)}</Notice> : null}
          {quote.data?.quotes.map((q) => {
            const active = q.lineId === selectedLine?.lineId;
            return (
              <Pressable
                key={q.lineId}
                disabled={!q.available}
                onPress={() => setLineId(q.lineId)}
                style={[styles.line, active && styles.optionActive, !q.available && { opacity: 0.45 }]}>
                <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={q.available ? colors.primary : colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{q.name}</Text>
                  <Text style={styles.meta}>
                    {q.available ? `${q.deliveryDays[0]}–${q.deliveryDays[1]} jours · facturé ${q.chargeableWeightKg} kg` : q.unavailableReason}
                  </Text>
                </View>
                {q.available ? <Text style={styles.linePrice}>{formatCny(q.total)}</Text> : null}
              </Pressable>
            );
          })}
        </Card>

        <Card style={{ gap: spacing.xs }}>
          <Field label="Code promo expédition" value={coupon} onChangeText={setCoupon} placeholder="Ex. : COLIS30" autoCapitalize="characters" />
          <Divider />
          {selectedLine ? (
            <>
              <Row label="Fret" value={formatCny(selectedLine.freight)} />
              {selectedLine.fuelSurcharge ? <Row label="Surcharge carburant" value={formatCny(selectedLine.fuelSurcharge)} /> : null}
              <Row label="Frais de manutention" value={formatCny(selectedLine.handlingFee)} />
              {selectedLine.insurance ? <Row label="Assurance" value={formatCny(selectedLine.insurance)} /> : null}
            </>
          ) : null}
          {quote.data?.servicesTotal ? <Row label="Services d’emballage" value={formatCny(quote.data.servicesTotal)} /> : null}
          {quote.data?.storageFee ? <Row label="Stockage prolongé" value={formatCny(quote.data.storageFee)} /> : null}
          <Divider />
          <Row label="Total estimé" value={formatCny(total)} strong />
          {convert(total) ? <Row label="Soit environ" value={convert(total)!} muted /> : null}
          <Notice>Le poids réel est mesuré à l’emballage : la différence avec l’estimation est remboursée ou ajustée sur votre solde.</Notice>
        </Card>
        {error ? <Notice tone="danger">{error.text}</Notice> : null}
        {error?.lowBalance ? <Button title="Recharger mon solde" variant="secondary" icon="wallet-outline" onPress={() => router.push('/wallet')} /> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button title={`Payer l’expédition ${formatCny(total)}`} icon="airplane-outline" onPress={submit} loading={submitting} disabled={!selectedLine} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  cardTitle: { fontWeight: '800', fontSize: 15, color: colors.text },
  option: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionTitle: { fontWeight: '700', color: colors.text, fontSize: 14 },
  meta: { color: colors.textSecondary, fontSize: 12 },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  price: { fontWeight: '700', color: colors.text },
  line: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  linePrice: { fontWeight: '800', color: colors.primary, fontSize: 15 },
  footer: { padding: spacing.md, backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
