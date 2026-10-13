import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { AuthGate } from '@/components/blocks';
import { CountryPicker } from '@/components/CountryPicker';
import { Badge, Button, Card, EmptyState, ErrorView, Field, Loading, Notice } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import type { Address } from '@/lib/types';

const EMPTY = { fullName: '', phone: '', country: 'FR', city: '', line1: '', line2: '', postalCode: '', isDefault: false };

export default function AddressesScreen() {
  return (
    <AuthGate>
      <Addresses />
    </AuthGate>
  );
}

function Addresses() {
  const queryClient = useQueryClient();
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: () => api<Address[]>('/addresses') });
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => (editingId ? api(`/addresses/${editingId}`, { method: 'PUT', body: form }) : api('/addresses', { body: form })),
    onSuccess: () => {
      setForm(null);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/addresses/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  });

  if (addresses.isLoading) return <Loading />;
  if (addresses.error) return <ErrorView message={errorMessage(addresses.error)} onRetry={() => addresses.refetch()} />;
  const set = (key: keyof typeof EMPTY) => (value: string | boolean) => setForm((f) => (f ? { ...f, [key]: value } : f));

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {form ? (
        <Card style={{ gap: spacing.md }}>
          <Text style={styles.title}>{editingId ? 'Modifier l’adresse' : 'Nouvelle adresse'}</Text>
          <Field label="Nom complet" value={form.fullName} onChangeText={set('fullName')} />
          <Field label="Téléphone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
          <CountryPicker value={form.country} onChange={set('country')} label="Pays" />
          <Field label="Ville" value={form.city} onChangeText={set('city')} />
          <Field label="Adresse" value={form.line1} onChangeText={set('line1')} />
          <Field label="Complément (facultatif)" value={form.line2} onChangeText={set('line2')} />
          <Field label="Code postal" value={form.postalCode} onChangeText={set('postalCode')} />
          <View style={styles.switchRow}>
            <Text style={{ color: colors.text }}>Adresse par défaut</Text>
            <Switch value={form.isDefault} onValueChange={set('isDefault')} trackColor={{ true: colors.primary }} />
          </View>
          {save.error ? <Notice tone="danger">{errorMessage(save.error)}</Notice> : null}
          <View style={styles.actions}>
            <Button title="Annuler" variant="ghost" style={{ flex: 1 }} onPress={() => setForm(null)} />
            <Button title="Enregistrer" style={{ flex: 1 }} onPress={() => save.mutate()} loading={save.isPending} />
          </View>
        </Card>
      ) : (
        <Button
          title="Ajouter une adresse"
          icon="add"
          onPress={() => {
            setEditingId(null);
            setForm(EMPTY);
          }}
        />
      )}

      {!addresses.data?.length && !form ? <EmptyState icon="location-outline" title="Aucune adresse" message="Ajoutez l’adresse où vous souhaitez recevoir vos colis." /> : null}

      {addresses.data?.map((a) => (
        <Card key={a.id} style={{ gap: 4 }}>
          <View style={styles.row}>
            <Text style={styles.title}>{a.fullName}</Text>
            {a.isDefault ? <Badge label="Par défaut" color={colors.primary} background={colors.primarySoft} /> : null}
          </View>
          <Text style={styles.meta}>{a.phone}</Text>
          <Text style={styles.meta}>
            {a.line1}
            {a.line2 ? `, ${a.line2}` : ''}
          </Text>
          <Text style={styles.meta}>
            {a.postalCode} {a.city}, {a.country}
          </Text>
          <View style={[styles.actions, { marginTop: spacing.sm }]}>
            <Button
              small
              variant="ghost"
              title="Modifier"
              onPress={() => {
                setEditingId(a.id);
                setForm({ ...EMPTY, ...a, line2: a.line2 ?? '' });
              }}
            />
            <Button small variant="danger" title="Supprimer" onPress={() => confirm('Supprimer cette adresse ?', `${a.line1}, ${a.city}`, () => remove.mutate(a.id))} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { fontWeight: '800', fontSize: 15, color: colors.text },
  meta: { color: colors.textSecondary, fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
});
