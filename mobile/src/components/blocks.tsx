import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';
import { formatDate } from '@/lib/labels';
import { useSession } from '@/lib/session';
import type { TimelineEvent } from '@/lib/types';
import { Button, EmptyState } from './ui';

/** Barre de recherche : mots-clés (français ou chinois) ou lien collé. */
export function SearchBar({ initial = '', autoFocus, onSubmit }: { initial?: string; autoFocus?: boolean; onSubmit?: (q: string) => void }) {
  const [value, setValue] = useState(initial);
  const submit = (text = value) => {
    const q = text.trim();
    if (!q) return;
    if (/https?:\/\/|\.com\/|\.cn\//i.test(q)) {
      router.push({ pathname: '/link', params: { text: q } });
      return;
    }
    if (onSubmit) onSubmit(q);
    else router.push({ pathname: '/search', params: { q } });
  };
  const paste = async () => {
    const text = await Clipboard.getStringAsync().catch(() => '');
    if (text) {
      setValue(text);
      submit(text);
    } else {
      router.push('/link');
    }
  };
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={setValue}
        onSubmitEditing={() => submit()}
        placeholder="Rechercher ou coller un lien Taobao, 1688…"
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        autoFocus={autoFocus}
        style={styles.searchInput}
      />
      <Pressable onPress={paste} style={styles.pasteBtn} accessibilityLabel="Coller un lien">
        <Ionicons name="clipboard-outline" size={16} color={colors.primary} />
        <Text style={styles.pasteText}>Coller</Text>
      </Pressable>
    </View>
  );
}

/** Étapes horizontales (commande ou colis). */
export function Steps<T extends string>({ steps, current, canceled }: { steps: { status: T; label: string }[]; current: T; canceled?: boolean }) {
  const index = steps.findIndex((s) => s.status === current);
  return (
    <View style={styles.steps}>
      {steps.map((step, i) => {
        const done = !canceled && i <= index;
        return (
          <View key={step.status} style={styles.step}>
            <View style={styles.stepLineWrap}>
              <View style={[styles.stepLine, i === 0 && { opacity: 0 }, done && { backgroundColor: colors.primary }]} />
              <View style={[styles.stepDot, done && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {done ? <Ionicons name="checkmark" size={11} color="#fff" /> : null}
              </View>
              <View style={[styles.stepLine, i === steps.length - 1 && { opacity: 0 }, !canceled && i < index && { backgroundColor: colors.primary }]} />
            </View>
            <Text style={[styles.stepLabel, done && { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Historique vertical des événements. */
export function Timeline({ events, labels }: { events: TimelineEvent[]; labels: Record<string, { label: string }> }) {
  return (
    <View>
      {[...events].reverse().map((e, i) => (
        <View key={`${e.at}-${i}`} style={styles.tlRow}>
          <View style={styles.tlRail}>
            <View style={[styles.tlDot, i === 0 && { backgroundColor: colors.primary }]} />
            {i < events.length - 1 ? <View style={styles.tlLine} /> : null}
          </View>
          <View style={styles.tlBody}>
            <Text style={[styles.tlTitle, i === 0 && { color: colors.primary }]}>{labels[e.status]?.label ?? e.status}</Text>
            {e.note ? <Text style={styles.tlNote}>{e.note}</Text> : null}
            <Text style={styles.tlDate}>{formatDate(e.at)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Affiché à la place d'un écran privé quand l'utilisateur n'est pas connecté. */
export function AuthGate({ children, message }: { children: React.ReactNode; message?: string }) {
  const { token, ready } = useSession();
  if (!ready) return null;
  if (token) return <>{children}</>;
  return (
    <EmptyState
      icon="person-circle-outline"
      title="Connectez-vous"
      message={message ?? 'Créez un compte ou connectez-vous pour gérer votre panier, vos commandes et votre entrepôt.'}
      action={<Button title="Se connecter" icon="log-in-outline" onPress={() => router.push('/login')} />}
    />
  );
}

export function DemoBanner() {
  return (
    <View style={styles.demo}>
      <Ionicons name="flask-outline" size={14} color={colors.warning} />
      <Text style={styles.demoText}>Données de démonstration – branchez un fournisseur d’API pour voir les vrais articles.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingLeft: spacing.md,
    paddingRight: 4,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 8 },
  pasteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill },
  pasteText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  steps: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepLineWrap: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border },
  stepDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 11, color: colors.textMuted },
  tlRow: { flexDirection: 'row', gap: spacing.md },
  tlRail: { alignItems: 'center', width: 14 },
  tlDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border, marginTop: 5 },
  tlLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  tlBody: { flex: 1, paddingBottom: spacing.lg, gap: 2 },
  tlTitle: { fontWeight: '700', color: colors.text, fontSize: 14 },
  tlNote: { color: colors.textSecondary, fontSize: 13 },
  tlDate: { color: colors.textMuted, fontSize: 12 },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.warningSoft, paddingHorizontal: spacing.md, paddingVertical: 6 },
  demoText: { flex: 1, color: colors.warning, fontSize: 12, fontWeight: '600' },
});
