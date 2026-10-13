import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProviderSettingsCard } from '@/components/ProviderSettingsCard';
import { Button, Card, Chip, Field, Notice, Row } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { apiConfig, defaultApiUrl } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { useRates } from '@/lib/money';
import { useMeta, useSession } from '@/lib/session';

const CURRENCY_NAMES: Record<string, string> = {
  CNY: 'Yuan',
  EUR: 'Euro',
  USD: 'Dollar US',
  GBP: 'Livre',
  CAD: 'Dollar CA',
  CHF: 'Franc suisse',
  MGA: 'Ariary',
  XOF: 'Franc CFA (BCEAO)',
  XAF: 'Franc CFA (BEAC)',
  MAD: 'Dirham',
};

export default function SettingsScreen() {
  const { currency, setCurrency, apiUrl, setApiUrl, apiMode, setApiMode, resetLocal } = useSession();
  const meta = useMeta();
  const rates = useRates();
  const [url, setUrl] = useState(apiUrl ?? '');
  const [saved, setSaved] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Card style={{ gap: spacing.md }}>
        <Text style={styles.title}>Devise d’affichage</Text>
        <Text style={styles.meta}>Les prix restent payés en yuans (CNY) ; la conversion est indicative.</Text>
        <View style={styles.wrap}>
          {(meta.data?.currencies ?? ['CNY', 'EUR', 'USD']).map((c) => (
            <Chip key={c} label={`${c} · ${CURRENCY_NAMES[c] ?? c}`} active={currency === c} onPress={() => setCurrency(c)} />
          ))}
        </View>
        {rates.data ? (
          <Text style={styles.meta}>
            1 CNY = {rates.data.rates[currency]} {currency} ·{' '}
            {rates.data.source === 'live' ? `taux en ligne du ${new Date(rates.data.updatedAt).toLocaleString('fr-FR')}` : 'taux approximatifs hors ligne'}
          </Text>
        ) : null}
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={styles.title}>Source des données</Text>
        <View style={styles.wrap}>
          <Chip label="Intégrée (hors ligne)" active={apiMode === 'local'} onPress={() => apiMode !== 'local' && setApiMode('local')} />
          <Chip label="Serveur Roysti" active={apiMode === 'remote'} onPress={() => apiMode !== 'remote' && setApiMode('remote')} />
        </View>
        {apiMode === 'local' ? (
          <>
            <Text style={styles.meta}>
              L’application fonctionne seule, sans serveur : votre compte, vos commandes et vos colis sont enregistrés sur ce téléphone. Les articles viennent du catalogue de démonstration ou, avec une clé, d’une vraie API (ci-dessous).
            </Text>
            {resetDone ? <Notice tone="success">Données réinitialisées. Reconnectez-vous avec le compte démo.</Notice> : null}
            <Button
              title="Réinitialiser les données de démo"
              variant="danger"
              icon="refresh"
              onPress={() =>
                confirm('Réinitialiser ?', 'Comptes, commandes, colis et solde enregistrés sur ce téléphone seront effacés.', async () => {
                  await resetLocal();
                  setResetDone(true);
                })
              }
            />
          </>
        ) : (
          <>
            <Field label="Adresse de l’API" value={url} onChangeText={setUrl} placeholder={defaultApiUrl()} autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.meta}>Actuellement : {apiConfig.baseUrl}</Text>
            {saved ? <Notice tone="success">Adresse enregistrée.</Notice> : null}
            <Button
              title="Enregistrer"
              variant="secondary"
              onPress={async () => {
                await setApiUrl(url || null);
                setSaved(true);
              }}
            />
          </>
        )}
        {meta.data ? (
          <View>
            <Row label="Fournisseur de données" value={meta.data.provider} />
            <Row label="Données" value={meta.data.isDemoData ? 'Démonstration' : 'Réelles'} />
            <Row label="Mode démo (simulation entrepôt)" value={meta.data.demoMode ? 'Activé' : 'Désactivé'} />
          </View>
        ) : null}
      </Card>

      <ProviderSettingsCard />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md },
  title: { fontWeight: '800', color: colors.text, fontSize: 15 },
  meta: { color: colors.textSecondary, fontSize: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
