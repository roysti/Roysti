import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { CountryPicker } from '@/components/CountryPicker';
import { Button, Card, Field, Notice } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { formatCny, useMoney } from '@/lib/money';
import type { ShippingQuote } from '@/lib/types';

const num = (v: string) => Number(v.replace(',', '.')) || undefined;

export default function EstimateScreen() {
  const { convert } = useMoney();
  const [country, setCountry] = useState('FR');
  const [weight, setWeight] = useState('1');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [sensitive, setSensitive] = useState(false);

  const estimate = useMutation({
    mutationFn: () =>
      api<{ quotes: ShippingQuote[] }>('/shipping/estimate', {
        body: { country, weightKg: num(weight), lengthCm: num(length), widthCm: num(width), heightCm: num(height), sensitive },
      }),
  });

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Card style={{ gap: spacing.md }}>
        <CountryPicker value={country} onChange={setCountry} />
        <Field label="Poids réel (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
        <Text style={styles.label}>Dimensions du colis (cm, facultatif)</Text>
        <View style={styles.dims}>
          <View style={{ flex: 1 }}>
            <Field label="Longueur" value={length} onChangeText={setLength} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Largeur" value={width} onChangeText={setWidth} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Hauteur" value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
          </View>
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Contient batterie / liquide / poudre</Text>
          <Switch value={sensitive} onValueChange={setSensitive} trackColor={{ true: colors.primary }} />
        </View>
        <Button title="Calculer" icon="calculator-outline" onPress={() => estimate.mutate()} loading={estimate.isPending} disabled={!num(weight)} />
      </Card>

      <Notice>
        Le transporteur facture le plus grand entre le poids réel et le poids volumétrique (longueur × largeur × hauteur ÷ diviseur de la ligne, 5 000 ou 6 000).
        Tarifs indicatifs.
      </Notice>
      {estimate.error ? <Notice tone="danger">{errorMessage(estimate.error)}</Notice> : null}

      {estimate.data?.quotes.map((q) => (
        <Card key={q.lineId} style={[styles.quote, !q.available && { opacity: 0.5 }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.name}>{q.name}</Text>
            <Text style={styles.meta}>{q.description}</Text>
            <Text style={styles.meta}>
              {q.available
                ? `${q.deliveryDays[0]}–${q.deliveryDays[1]} jours · facturé ${q.chargeableWeightKg} kg${q.volumetricWeightKg ? ` (volumétrique ${q.volumetricWeightKg} kg)` : ''}`
                : q.unavailableReason}
            </Text>
          </View>
          {q.available ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.price}>{formatCny(q.total)}</Text>
              {convert(q.total) ? <Text style={styles.meta}>≈ {convert(q.total)}</Text> : null}
            </View>
          ) : null}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  dims: { flexDirection: 'row', gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { color: colors.text, flex: 1 },
  quote: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  name: { fontWeight: '800', color: colors.text },
  meta: { color: colors.textSecondary, fontSize: 12 },
  price: { fontWeight: '900', color: colors.primary, fontSize: 17 },
});
