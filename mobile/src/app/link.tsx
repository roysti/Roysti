import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Field, Notice } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import type { Platform } from '@/lib/types';

const EXAMPLES = [
  'item.taobao.com/item.htm?id=…',
  'detail.tmall.com/item.htm?id=…',
  'detail.1688.com/offer/….html',
  'alibaba.com/product-detail/…_….html',
  'item.jd.com/….html',
  'weidian.com/item.html?itemID=…',
  'Liens courts m.tb.cn et textes de partage 【淘宝】',
  'Liens CSSBuy et Superbuy',
];

const parseLink = (text: string) => api<{ platform: Platform; itemId: string }>('/links/parse', { body: { text } });

export default function LinkScreen() {
  const params = useLocalSearchParams<{ text?: string }>();
  const [text, setText] = useState(params.text ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Analyse automatique du texte reçu en paramètre (lien collé dans la barre de recherche).
  const auto = useQuery({ queryKey: ['parse-link', params.text], queryFn: () => parseLink(params.text!), enabled: !!params.text, retry: false });
  useEffect(() => {
    if (auto.data) router.replace({ pathname: '/product/[platform]/[itemId]', params: auto.data });
  }, [auto.data]);

  const analyze = async (value = text) => {
    if (!value.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const parsed = await parseLink(value);
      router.replace({ pathname: '/product/[platform]/[itemId]', params: parsed });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  const shownError = error ?? (auto.error ? errorMessage(auto.error) : null);

  const paste = async () => {
    const value = await Clipboard.getStringAsync().catch(() => '');
    setText(value);
    if (value) analyze(value);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>Collez le lien d’un article (ou le texte de partage de l’application Taobao) : nous retrouvons la fiche, le prix et les options.</Text>
      <Field label="Lien de l’article" value={text} onChangeText={setText} placeholder="https://item.taobao.com/item.htm?id=…" multiline autoCapitalize="none" autoCorrect={false} />
      {shownError ? <Notice tone="danger">{shownError}</Notice> : null}
      <View style={styles.actions}>
        <Button title="Coller" icon="clipboard-outline" variant="secondary" onPress={paste} style={{ flex: 1 }} />
        <Button title="Analyser" icon="search" onPress={() => analyze()} loading={loading || auto.isFetching} style={{ flex: 1 }} />
      </View>
      <Card style={{ gap: 6 }}>
        <Text style={styles.cardTitle}>Formats acceptés</Text>
        {EXAMPLES.map((e) => (
          <Text key={e} style={styles.example}>
            • {e}
          </Text>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },
  intro: { color: colors.textSecondary, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  cardTitle: { fontWeight: '800', color: colors.text, marginBottom: 4 },
  example: { color: colors.textSecondary, fontSize: 13 },
});
