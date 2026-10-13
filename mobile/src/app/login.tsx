import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Field, Notice } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { useMeta, useSession } from '@/lib/session';

export default function LoginScreen() {
  const { signIn } = useSession();
  const meta = useMeta();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (credentials = { email, password }, as = mode) => {
    setLoading(true);
    setError(null);
    try {
      const path = as === 'login' ? '/auth/login' : '/auth/register';
      const res = await api<{ token: string }>(path, { body: as === 'login' ? credentials : { ...credentials, name } });
      await signIn(res.token);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.brand}>Roysti</Text>
      <Text style={styles.subtitle}>Votre agent d’achat en Chine</Text>
      <View style={styles.tabs}>
        <Chip label="Connexion" active={mode === 'login'} onPress={() => setMode('login')} />
        <Chip label="Créer un compte" active={mode === 'register'} onPress={() => setMode('register')} />
      </View>
      {mode === 'register' ? <Field label="Nom" value={name} onChangeText={setName} placeholder="Votre nom" /> : null}
      <Field label="E-mail" value={email} onChangeText={setEmail} placeholder="vous@exemple.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Mot de passe" value={password} onChangeText={setPassword} placeholder="6 caractères minimum" secureTextEntry />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button title={mode === 'login' ? 'Se connecter' : 'Créer mon compte'} onPress={() => submit()} loading={loading} />
      {meta.data?.demoMode ? (
        <Button
          title="Utiliser le compte démo"
          variant="ghost"
          icon="flask-outline"
          onPress={() => {
            setMode('login');
            submit({ email: 'demo@roysti.app', password: 'demo1234' }, 'login');
          }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.lg },
  brand: { fontSize: 32, fontWeight: '900', color: colors.primary, textAlign: 'center', marginTop: spacing.lg },
  subtitle: { textAlign: 'center', color: colors.textSecondary, marginTop: -spacing.md },
  tabs: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
});
