import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Field, Notice } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { AuthResult, OtpChannel, OtpPurpose, OtpSent } from '@/lib/types';

const TITLES: Record<OtpPurpose, string> = {
  login: 'Code de connexion',
  verify: 'Confirmer vos coordonnées',
  reset: 'Nouveau mot de passe',
};

export default function OtpScreen() {
  const params = useLocalSearchParams<{
    channel: OtpChannel;
    destination: string;
    masked: string;
    purpose: OtpPurpose;
    resendIn?: string;
    demoCode?: string;
    name?: string;
    from?: 'login' | 'profile';
  }>();
  const { signIn } = useSession();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [demoCode, setDemoCode] = useState(params.demoCode || '');
  const [masked, setMasked] = useState(params.masked);
  const [countdown, setCountdown] = useState(Number(params.resendIn) || 60);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitted = useRef('');

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const target = { channel: params.channel, destination: params.destination };

  /** Ferme l'écran du code (et l'écran de connexion s'il est en dessous). */
  const finish = () => {
    if (params.from === 'login' && router.canDismiss()) router.dismiss(2);
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const submit = async (value = code) => {
    if (value.length !== 6) return setError('Saisissez les 6 chiffres du code');
    if (params.purpose === 'reset' && newPassword.length < 8) return setError('Nouveau mot de passe : 8 caractères minimum');
    setLoading(true);
    setError(null);
    try {
      if (params.purpose === 'verify') {
        await api('/me/verify', { body: { ...target, code: value } });
        await queryClient.invalidateQueries({ queryKey: ['me'] });
      } else {
        const res =
          params.purpose === 'login'
            ? await api<AuthResult>('/auth/otp/verify', { body: { ...target, code: value, name: params.name || undefined } })
            : await api<AuthResult>('/auth/password/reset', { body: { ...target, code: value, newPassword } });
        await signIn(res.token);
      }
      finish();
    } catch (e) {
      setError(errorMessage(e));
      submitted.current = '';
    } finally {
      setLoading(false);
    }
  };

  const onChangeCode = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    // Validation automatique au 6e chiffre (une seule fois par code saisi).
    if (digits.length === 6 && params.purpose !== 'reset' && submitted.current !== digits) {
      submitted.current = digits;
      submit(digits);
    }
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    try {
      const sent = await api<OtpSent>('/auth/otp/request', { body: { ...target, purpose: params.purpose } });
      setDemoCode(sent.demoCode ?? '');
      setMasked(sent.destinationMasked);
      setCountdown(sent.resendInSec);
      setCode('');
      setInfo('Nouveau code envoyé.');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: TITLES[params.purpose] ?? 'Code' }} />
      <Text style={styles.intro}>
        Saisissez le code à 6 chiffres envoyé {params.channel === 'sms' ? 'par SMS au' : 'par e-mail à'} <Text style={styles.strong}>{masked}</Text>. Il est valable 10 minutes.
      </Text>

      <TextInput
        value={code}
        onChangeText={onChangeCode}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        autoComplete={params.channel === 'sms' ? 'sms-otp' : 'one-time-code'}
        textContentType="oneTimeCode"
        placeholder="••••••"
        placeholderTextColor={colors.textMuted}
        style={styles.code}
        accessibilityLabel="Code à 6 chiffres"
      />

      {demoCode ? (
        <Notice tone="warning">
          Mode démonstration : aucun message n’a été envoyé. Votre code est <Text style={styles.strong}>{demoCode}</Text>.
        </Notice>
      ) : null}
      {demoCode ? <Button small variant="secondary" title="Remplir le code de démonstration" onPress={() => onChangeCode(demoCode)} /> : null}

      {params.purpose === 'reset' ? (
        <Field label="Nouveau mot de passe (8 caractères minimum)" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" />
      ) : null}

      {info ? <Notice tone="success">{info}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Button title={params.purpose === 'reset' ? 'Changer le mot de passe' : 'Valider'} onPress={() => submit()} loading={loading} disabled={code.length !== 6} />

      <View style={styles.resend}>
        {countdown > 0 ? (
          <Text style={styles.muted}>Renvoyer le code dans {countdown} s</Text>
        ) : (
          <Pressable onPress={resend} hitSlop={8}>
            <Text style={styles.link}>Renvoyer le code</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.lg },
  intro: { color: colors.textSecondary, lineHeight: 21, fontSize: 15 },
  strong: { fontWeight: '800', color: colors.text },
  code: {
    fontSize: 32,
    letterSpacing: 12,
    textAlign: 'center',
    fontWeight: '800',
    color: colors.text,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
  },
  resend: { alignItems: 'center' },
  muted: { color: colors.textMuted },
  link: { color: colors.info, fontWeight: '700' },
});
