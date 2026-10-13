import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PhoneField } from '@/components/PhoneField';
import { Button, Chip, Field, Notice } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { DEFAULT_PHONE_COUNTRY } from '@/lib/phone';
import { useMeta, useSession } from '@/lib/session';
import { openOtp } from '@/lib/otp';
import type { AuthResult, OtpPurpose, OtpSent } from '@/lib/types';

type Mode = 'login' | 'register';
type IdType = 'phone' | 'email';
type Method = 'code' | 'password';

interface AuthConfig {
  /** available = false : le serveur n'envoie pas de codes sur ce canal (connexion par mot de passe). */
  channels: { email: { demo: boolean; available?: boolean }; sms: { demo: boolean; available?: boolean } };
  passwordMinLength: number;
}

export default function LoginScreen() {
  const { signIn } = useSession();
  const meta = useMeta();
  const authConfig = useQuery({ queryKey: ['auth-config'], queryFn: () => api<AuthConfig>('/auth/config') });
  const [mode, setMode] = useState<Mode>('login');
  const [idType, setIdType] = useState<IdType>('phone');
  const [method, setMethod] = useState<Method>('code');
  const [country, setCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const channel = idType === 'phone' ? 'sms' : 'email';
  const identifier = idType === 'phone' ? phone : email;
  const codeAvailable = authConfig.data?.channels[channel].available !== false;
  const isDemoChannel = codeAvailable && authConfig.data?.channels[channel].demo;
  const loginMethod: Method = codeAvailable ? method : 'password';
  const minLength = authConfig.data?.passwordMinLength ?? 8;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const run = async (key: string, action: () => Promise<void>) => {
    setLoading(key);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(null);
    }
  };

  const sendCode = (purpose: OtpPurpose) =>
    run(purpose, async () => {
      if (!identifier.trim()) throw new Error(idType === 'phone' ? 'Saisissez votre numéro de téléphone' : 'Saisissez votre e-mail');
      const sent = await api<OtpSent>('/auth/otp/request', { body: { channel, destination: identifier, country, purpose } });
      openOtp(sent, purpose, { name });
    });

  const passwordLogin = () =>
    run('password', async () => {
      const res = await api<AuthResult>('/auth/login', { body: { identifier, country, password } });
      await signIn(res.token);
      close();
    });

  const register = () =>
    run('register', async () => {
      const res = await api<AuthResult>('/auth/register', {
        body: { ...(idType === 'phone' ? { phone } : { email }), country, password, name },
      });
      await signIn(res.token);
      if (res.verification) {
        router.back();
        openOtp(res.verification, 'verify', { from: 'profile' });
      } else close();
    });

  const demoLogin = () =>
    run('demo', async () => {
      const res = await api<AuthResult>('/auth/login', { body: { identifier: 'demo@roysti.app', password: 'demo1234' } });
      await signIn(res.token);
      close();
    });

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.brand}>Roysti</Text>
      <Text style={styles.subtitle}>Votre agent d’achat en Chine</Text>

      <View style={styles.tabs}>
        {(['login', 'register'] as const).map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} style={[styles.tab, mode === m && styles.tabActive]}>
            <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>{m === 'login' ? 'Connexion' : 'Créer un compte'}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.chips}>
        <Chip label="📱 Téléphone" active={idType === 'phone'} onPress={() => setIdType('phone')} />
        <Chip label="✉️ E-mail" active={idType === 'email'} onPress={() => setIdType('email')} />
      </View>

      {mode === 'register' ? <Field label="Nom" value={name} onChangeText={setName} placeholder="Votre nom" autoComplete="name" /> : null}

      {idType === 'phone' ? (
        <PhoneField country={country} onCountryChange={setCountry} value={phone} onChangeText={setPhone} />
      ) : (
        <Field label="E-mail" value={email} onChangeText={setEmail} placeholder="vous@exemple.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      )}

      {mode === 'login' ? (
        <>
          {codeAvailable ? (
            <View style={styles.chips}>
              <Chip label={`Code par ${idType === 'phone' ? 'SMS' : 'e-mail'}`} active={method === 'code'} onPress={() => setMethod('code')} />
              <Chip label="Mot de passe" active={method === 'password'} onPress={() => setMethod('password')} />
            </View>
          ) : (
            <Text style={styles.hint}>Les codes par {idType === 'phone' ? 'SMS' : 'e-mail'} ne sont pas disponibles sur ce serveur : connectez-vous avec votre mot de passe.</Text>
          )}
          {loginMethod === 'password' ? (
            <>
              <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
              {codeAvailable ? (
                <Pressable onPress={() => sendCode('reset')} hitSlop={8}>
                  <Text style={styles.link}>Mot de passe oublié ?</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <Text style={styles.hint}>
              Nous vous envoyons un code à 6 chiffres. Si vous n’avez pas encore de compte, il est créé automatiquement.
            </Text>
          )}
        </>
      ) : (
        <Field label={`Mot de passe (${minLength} caractères minimum)`} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      )}

      {isDemoChannel ? (
        <Notice tone="warning">
          Mode démonstration : aucun {idType === 'phone' ? 'SMS' : 'e-mail'} n’est réellement envoyé, le code s’affichera à l’écran. Un serveur Roysti configuré avec Twilio
          (SMS) ou Resend (e-mail) envoie de vrais codes.
        </Notice>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {mode === 'register' ? (
        <Button title="Créer mon compte" icon="person-add-outline" onPress={register} loading={loading === 'register'} disabled={!!loading} />
      ) : loginMethod === 'code' ? (
        <Button title="Recevoir un code" icon="chatbubble-ellipses-outline" onPress={() => sendCode('login')} loading={loading === 'login'} disabled={!!loading} />
      ) : (
        <Button title="Se connecter" icon="log-in-outline" onPress={passwordLogin} loading={loading === 'password'} disabled={!!loading} />
      )}

      {meta.data?.demoMode ? (
        <Button title="Utiliser le compte démo" variant="ghost" icon="flask-outline" onPress={demoLogin} loading={loading === 'demo'} disabled={!!loading} />
      ) : null}
      <Text style={styles.demoHint}>Compte démo : demo@roysti.app ou +33 6 39 98 00 00 · mot de passe demo1234</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.lg },
  brand: { fontSize: 32, fontWeight: '900', color: colors.primary, textAlign: 'center', marginTop: spacing.md },
  subtitle: { textAlign: 'center', color: colors.textSecondary, marginTop: -spacing.md },
  tabs: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
  tabActive: { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 1 },
  tabText: { fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: colors.primary },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  link: { color: colors.info, fontWeight: '600', textAlign: 'right' },
  hint: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  demoHint: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
