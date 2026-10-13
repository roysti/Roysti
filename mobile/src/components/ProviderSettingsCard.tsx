import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, Field, Notice } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { applyProviderSettings, testProviderSettings, type ProviderTestResult } from '@/lib/local-api';
import { formatCny } from '@/lib/money';
import { DEMO_SETTINGS, loadProviderSettings, type ProviderSettings } from '@/lib/provider-settings';
import { useSession } from '@/lib/session';

type Name = ProviderSettings['provider'];

const PROVIDERS: { id: Name; label: string; platforms: string; details: string; signup?: { label: string; url: string }[] }[] = [
  { id: 'mock', label: 'Démo', platforms: 'Catalogue fictif', details: 'Articles de démonstration, sans clé ni connexion Internet.' },
  {
    id: 'otapi',
    label: 'OTAPI · RapidAPI',
    platforms: 'Taobao, Tmall, 1688 · titres traduits en anglais',
    details:
      'Le plus simple hors de Chine : créez un compte RapidAPI (carte bancaire demandée), abonnez-vous à « Taobao Tmall » et/ou « Otapi 1688 » d’OpenTrade Commerce, puis copiez votre clé X-RapidAPI-Key. Palier gratuit limité (environ 20 requêtes par jour d’après leur page de tarifs), dépassements facturés.',
    signup: [
      { label: 'API Taobao Tmall', url: 'https://rapidapi.com/open-trade-commerce-open-trade-commerce-default/api/taobao-tmall1' },
      { label: 'API Otapi 1688', url: 'https://rapidapi.com/open-trade-commerce-open-trade-commerce-default/api/otapi-1688' },
    ],
  },
  {
    id: 'onebound',
    label: 'Onebound',
    platforms: 'Taobao, Tmall, 1688, JD, Alibaba.com, Weidian · titres en chinois ou en anglais',
    details:
      'Passerelle chinoise (万邦) : une clé (key) et un secret. Essai limité (10 appels par jour pendant quelques jours), puis environ 0,02 CNY par appel selon des sources secondaires. Chaque appel est facturé, même en cas d’échec.',
    signup: [{ label: 'Console Onebound', url: 'https://console.open.onebound.cn/console/?lang_code=en' }],
  },
  {
    id: 'tmapi',
    label: 'TMAPI',
    platforms: '1688 (recherche et fiches) · Taobao/Tmall par lien uniquement',
    details: 'apiToken à copier dans la console TMAPI (Account Center). Tarifs : à voir avec TMAPI.',
    signup: [
      { label: 'Site TMAPI', url: 'https://tmapi.top' },
      { label: 'Console (apiToken)', url: 'https://console.tmapi.io/account/center' },
    ],
  },
];

/** Choix et test du fournisseur d'articles réels (mode intégré). */
export function ProviderSettingsCard() {
  const { apiMode } = useSession();
  return apiMode === 'local' ? <LocalProviderSettings /> : <RemoteProviderStatus />;
}

function LocalProviderSettings() {
  const saved = useQuery({ queryKey: ['provider-settings'], queryFn: loadProviderSettings, staleTime: Infinity });
  if (!saved.data) return null;
  // Le formulaire garde son état après l'enregistrement (le message de résultat reste affiché).
  return <ProviderForm initial={saved.data} />;
}

function ProviderForm({ initial }: { initial: ProviderSettings }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProviderSettings>(initial);
  const [busy, setBusy] = useState<'test' | 'save' | null>(null);
  const [result, setResult] = useState<{ tone: 'success' | 'danger' | 'warning'; text: string; sample?: ProviderTestResult['sample'] } | null>(null);
  const info = PROVIDERS.find((p) => p.id === form.provider) ?? PROVIDERS[0]!;
  const changed = JSON.stringify(form) !== JSON.stringify(initial);
  /** Réglages déjà testés avec succès : « Enregistrer » ne refait pas l'appel (facturé). */
  const testedOk = useRef<string | null>(null);

  const patch = <K extends 'onebound' | 'tmapi' | 'otapi'>(key: K, value: Partial<NonNullable<ProviderSettings[K]>>) =>
    setForm((f) => ({ ...f, [key]: { ...(f[key] ?? {}), ...value } }) as ProviderSettings);

  const test = async () => {
    setBusy('test');
    setResult(null);
    try {
      const r = await testProviderSettings(form);
      setResult({ tone: 'success', text: r.message, sample: r.sample });
      testedOk.current = JSON.stringify(form);
      return true;
    } catch (e) {
      setResult({ tone: 'danger', text: errorMessage(e) });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const save = async (skipTest = false) => {
    const alreadyTested = testedOk.current === JSON.stringify(form);
    if (!skipTest && !alreadyTested && form.provider !== 'mock' && !(await test())) return;
    setBusy('save');
    try {
      await applyProviderSettings(form);
      // Les articles changent de source : on repart de la première page (pas de rechargement
      // de toutes les pages déjà parcourues, chacune serait un appel facturé).
      await queryClient.resetQueries({ queryKey: ['search'] });
      await queryClient.invalidateQueries({ predicate: (q) => !['search', 'provider-settings'].includes(String(q.queryKey[0])) });
      setResult((r) => ({
        tone: 'success',
        text: form.provider === 'mock' ? 'Catalogue de démonstration rétabli.' : `${r?.tone === 'success' ? `${r.text} ` : ''}Réglages enregistrés : les recherches utilisent maintenant ${info.label}.`,
        sample: r?.sample,
      }));
    } catch (e) {
      setResult({ tone: 'danger', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <Text style={styles.title}>Articles réels (API)</Text>
      <Text style={styles.meta}>
        Les vrais articles Taobao, 1688… viennent d’un fournisseur d’API. Il vous faut une clé à vous (Roysti ne peut pas en fournir) : choisissez un fournisseur, collez votre clé,
        testez, puis enregistrez.
      </Text>
      <View style={styles.wrap}>
        {PROVIDERS.map((p) => (
          <Chip
            key={p.id}
            label={p.label}
            active={form.provider === p.id}
            onPress={() => {
              setForm((f) => ({ ...f, provider: p.id }));
              setResult(null);
            }}
          />
        ))}
      </View>
      <View style={styles.infoBox}>
        <Text style={styles.platforms}>{info.platforms}</Text>
        <Text style={styles.meta}>{info.details}</Text>
        {info.signup ? (
          <View style={styles.wrap}>
            {info.signup.map((s) => (
              <Button key={s.url} small variant="ghost" icon="open-outline" title={s.label} onPress={() => WebBrowser.openBrowserAsync(s.url).catch(() => undefined)} />
            ))}
          </View>
        ) : null}
      </View>

      {form.provider === 'otapi' ? (
        <Field
          label="Clé RapidAPI (X-RapidAPI-Key)"
          value={form.otapi?.rapidApiKey ?? ''}
          onChangeText={(v) => patch('otapi', { rapidApiKey: v })}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
      ) : null}

      {form.provider === 'onebound' ? (
        <>
          <Field label="Clé (key)" value={form.onebound?.key ?? ''} onChangeText={(v) => patch('onebound', { key: v })} autoCapitalize="none" autoCorrect={false} />
          <Field label="Secret" value={form.onebound?.secret ?? ''} onChangeText={(v) => patch('onebound', { secret: v })} autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <Text style={styles.label}>Langue des titres</Text>
          <View style={styles.wrap}>
            <Chip label="Chinois (d’origine)" active={(form.onebound?.lang ?? 'cn') === 'cn'} onPress={() => patch('onebound', { lang: 'cn' })} />
            <Chip label="Anglais (traduit)" active={form.onebound?.lang === 'en'} onPress={() => patch('onebound', { lang: 'en' })} />
          </View>
        </>
      ) : null}

      {form.provider === 'tmapi' ? (
        <>
          <Field label="apiToken" value={form.tmapi?.token ?? ''} onChangeText={(v) => patch('tmapi', { token: v })} autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <Text style={styles.label}>Langue des fiches 1688</Text>
          <View style={styles.wrap}>
            <Chip label="Chinois" active={(form.tmapi?.language ?? 'zh') === 'zh'} onPress={() => patch('tmapi', { language: 'zh' })} />
            <Chip label="Anglais" active={form.tmapi?.language === 'en'} onPress={() => patch('tmapi', { language: 'en' })} />
          </View>
        </>
      ) : null}

      {result ? (
        <Notice tone={result.tone}>
          {result.text}
          {result.sample ? `\nExemple : ${result.sample.title} · ${formatCny(result.sample.price)}` : ''}
        </Notice>
      ) : null}
      {result?.sample?.image ? <Image source={{ uri: result.sample.image }} style={styles.sample} contentFit="cover" /> : null}

      <View style={styles.actions}>
        {form.provider !== 'mock' ? <Button small variant="secondary" icon="flash-outline" title="Tester la connexion" onPress={test} loading={busy === 'test'} disabled={!!busy} /> : null}
        <Button small icon="save-outline" title="Enregistrer" onPress={() => save()} loading={busy === 'save'} disabled={!!busy || !changed} />
        {result?.tone === 'danger' && form.provider !== 'mock' ? <Button small variant="ghost" title="Enregistrer sans tester" onPress={() => save(true)} disabled={!!busy} /> : null}
      </View>
      {initial.provider !== 'mock' && form.provider === initial.provider ? (
        <Button small variant="ghost" icon="flask-outline" title="Revenir au catalogue de démonstration" onPress={() => setForm(DEMO_SETTINGS)} disabled={!!busy} />
      ) : null}
      <Text style={styles.meta}>
        Le test fait une seule petite recherche (un appel compté par le fournisseur). La clé est chiffrée sur ce téléphone et n’est envoyée qu’au fournisseur. Pour une application
        distribuée à des clients, placez plutôt la clé sur un serveur Roysti (mode « Serveur »).
      </Text>
    </Card>
  );
}

function RemoteProviderStatus() {
  const [state, setState] = useState<{ loading: boolean; tone?: 'success' | 'danger'; text?: string }>({ loading: false });
  return (
    <Card style={{ gap: spacing.md }}>
      <Text style={styles.title}>Articles réels (API)</Text>
      <Text style={styles.meta}>
        En mode serveur, le fournisseur et sa clé sont configurés sur le serveur Roysti (variables PRODUCT_PROVIDER, RAPIDAPI_KEY, ONEBOUND_KEY… : voir le README).
      </Text>
      {state.text ? <Notice tone={state.tone}>{state.text}</Notice> : null}
      <Button
        small
        variant="secondary"
        icon="flash-outline"
        title="Tester le fournisseur du serveur"
        loading={state.loading}
        onPress={async () => {
          setState({ loading: true });
          try {
            const r = await api<{ message: string; provider: string }>('/provider/test');
            setState({ loading: false, tone: 'success', text: `${r.provider} : ${r.message}` });
          } catch (e) {
            setState({ loading: false, tone: 'danger', text: errorMessage(e) });
          }
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: '800', color: colors.text, fontSize: 15 },
  meta: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  platforms: { color: colors.text, fontWeight: '700', fontSize: 13 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  infoBox: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  sample: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.background },
});
