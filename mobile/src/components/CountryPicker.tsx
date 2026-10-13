import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/constants/theme';
import { useMeta } from '@/lib/session';

export function CountryPicker({ value, onChange, label = 'Pays de destination' }: { value: string; onChange: (code: string) => void; label?: string }) {
  const meta = useMeta();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const countries = meta.data?.countries ?? [];
  const current = countries.find((c) => c.code === value);
  const list = countries.filter((c) => `${c.name} ${c.code}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={styles.value}>{current ? `${current.name} (${current.code})` : 'Choisir…'}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={styles.header}>
            <TextInput value={filter} onChangeText={setFilter} placeholder="Rechercher un pays" style={styles.search} placeholderTextColor={colors.textMuted} autoFocus />
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <Text style={styles.close}>Fermer</Text>
            </Pressable>
          </View>
          <FlatList
            data={list}
            keyExtractor={(c) => c.code}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => {
                  onChange(item.code);
                  setOpen(false);
                }}>
                <Text style={styles.value}>{item.name}</Text>
                <Text style={styles.code}>{item.code}</Text>
                {item.code === value ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  input: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    backgroundColor: colors.card,
  },
  value: { flex: 1, fontSize: 15, color: colors.text },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  search: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.card, color: colors.text },
  close: { color: colors.primary, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.card },
  code: { color: colors.textMuted, fontWeight: '600' },
});
