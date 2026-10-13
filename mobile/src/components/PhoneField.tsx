import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/constants/theme';
import { dialCode, flag, formatAsYouType } from '@/lib/phone';
import { useMeta } from '@/lib/session';

/** Saisie d'un numéro : indicatif pays + numéro national, mis en forme pendant la frappe. */
export function PhoneField({
  label = 'Numéro de téléphone',
  country,
  onCountryChange,
  value,
  onChangeText,
  autoFocus,
}: {
  label?: string;
  country: string;
  onCountryChange: (code: string) => void;
  value: string;
  onChangeText: (text: string) => void;
  autoFocus?: boolean;
}) {
  const meta = useMeta();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const countries = meta.data?.countries ?? [{ code: country, name: country }];
  const list = countries.filter((c) => `${c.name} ${c.code} ${dialCode(c.code)}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable style={styles.country} onPress={() => setOpen(true)} accessibilityLabel="Choisir l’indicatif">
          <Text style={styles.countryText}>
            {flag(country)} {dialCode(country)}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={(text) => onChangeText(text.startsWith('+') ? text : formatAsYouType(text, country))}
          placeholder={country === 'MG' ? '034 12 345 67' : 'Numéro'}
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          autoFocus={autoFocus}
          style={styles.input}
        />
      </View>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={styles.header}>
            <TextInput value={filter} onChangeText={setFilter} placeholder="Pays ou indicatif" style={styles.search} placeholderTextColor={colors.textMuted} autoFocus />
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <Text style={styles.close}>Fermer</Text>
            </Pressable>
          </View>
          <FlatList
            data={list}
            keyExtractor={(c) => c.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={styles.item}
                onPress={() => {
                  onCountryChange(item.code);
                  setOpen(false);
                }}>
                <Text style={styles.itemFlag}>{flag(item.code)}</Text>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemDial}>{dialCode(item.code)}</Text>
                {item.code === country ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
              </Pressable>
            )}
            ListFooterComponent={<Text style={styles.footer}>Autre pays : saisissez directement le numéro avec son indicatif (ex. +44…).</Text>}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  row: { flexDirection: 'row', gap: spacing.sm },
  country: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
  },
  countryText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  input: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
    letterSpacing: 0.5,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  search: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.card, color: colors.text },
  close: { color: colors.primary, fontWeight: '700' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.card },
  itemFlag: { fontSize: 20 },
  itemName: { flex: 1, fontSize: 15, color: colors.text },
  itemDial: { color: colors.textSecondary, fontWeight: '600' },
  footer: { padding: spacing.lg, color: colors.textSecondary, fontSize: 12 },
});
