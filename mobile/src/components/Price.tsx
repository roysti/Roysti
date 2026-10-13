import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { formatCny, useMoney } from '@/lib/money';

/** Prix en CNY (devise de la plateforme) et conversion approximative dans la devise choisie. */
export function Price({ cny, max, size = 'md', inline }: { cny: number; max?: number; size?: 'sm' | 'md' | 'lg'; inline?: boolean }) {
  const { convert, currency } = useMoney();
  const converted = currency !== 'CNY' ? convert(cny) : null;
  const fontSize = size === 'lg' ? 26 : size === 'md' ? 17 : 14;
  // Certains fournisseurs ne donnent pas le prix dans les résultats de recherche (0 ou -1).
  if (!(cny > 0)) return <Text style={[styles.unknown, { fontSize: fontSize * 0.8 }]}>Prix sur la fiche</Text>;
  return (
    <View style={inline ? styles.inline : undefined}>
      <Text style={[styles.cny, { fontSize }]}>
        {formatCny(cny)}
        {max && max > cny ? <Text style={{ fontSize: fontSize * 0.75 }}> – {formatCny(max)}</Text> : null}
      </Text>
      {converted ? <Text style={[styles.converted, size === 'lg' && { fontSize: 14 }]}>≈ {converted}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  cny: { color: colors.primary, fontWeight: '800' },
  converted: { color: colors.textSecondary, fontSize: 12, fontWeight: '500' },
  unknown: { color: colors.textSecondary, fontWeight: '700' },
});
