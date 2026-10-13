import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuthGate } from '@/components/blocks';
import { PhoneField } from '@/components/PhoneField';
import { Badge, Button, Card, Field, Loading, Notice } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { openOtp } from '@/lib/otp';
import { DEFAULT_PHONE_COUNTRY } from '@/lib/phone';
import { useMe } from '@/lib/session';
import type { OtpChannel, OtpSent, User } from '@/lib/types';

export default function ProfileScreen() {
  return (
    <AuthGate>
      <Profile />
    </AuthGate>
  );
}

function VerifiedBadge({ verified }: { verified?: boolean }) {
  return verified ? (
    <Badge label="Vérifié" color={colors.success} background={colors.successSoft} />
  ) : (
    <Badge label="Non vérifié" color={colors.warning} background={colors.warningSoft} />
  );
}

function Profile() {
  const me = useMe();
  const queryClient = useQueryClient();
  const user = me.data?.user;
  const [name, setName] = useState<string | null>(null);
  const [editing, setEditing] = useState<OtpChannel | null>(null);
  const [country, setCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  /** Mot de passe actuel, exigé pour remplacer un e-mail ou un numéro déjà vérifié. */
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['me'] });
  const onError = (e: unknown) => setMessage({ tone: 'danger', text: errorMessage(e) });

  const saveName = useMutation({
    mutationFn: () => api<{ user: User }>('/me', { method: 'PATCH', body: { name } }),
    onSuccess: () => {
      setName(null);
      setMessage({ tone: 'success', text: 'Nom enregistré.' });
      refresh();
    },
    onError,
  });

  const sendVerification = useMutation({
    mutationFn: ({ channel, destination }: { channel: OtpChannel; destination: string }) =>
      api<OtpSent>('/auth/otp/request', { body: { channel, destination, country, purpose: 'verify', currentPassword: confirmPassword || undefined } }),
    onSuccess: (sent) => {
      setEditing(null);
      setConfirmPassword('');
      setMessage(null);
      openOtp(sent, 'verify', { from: 'profile' });
    },
    onError,
  });

  const savePassword = useMutation({
    mutationFn: () => api('/me/password', { body: { currentPassword: currentPassword || undefined, newPassword } }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setMessage({ tone: 'success', text: 'Mot de passe enregistré. Vos autres appareils ont été déconnectés.' });
      refresh();
    },
    onError,
  });

  if (!user) return <Loading />;
  const replacing = (channel: OtpChannel) => user.hasPassword && (channel === 'sms' ? !!user.phone && user.phoneVerified : !!user.email && user.emailVerified);
  const passwordConfirm = (channel: OtpChannel) =>
    replacing(channel) ? (
      <Field label="Mot de passe actuel (pour confirmer le changement)" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="current-password" />
    ) : null;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <Card style={styles.card}>
        <Text style={styles.title}>Identité</Text>
        <Field label="Nom" value={name ?? user.name} onChangeText={setName} autoComplete="name" />
        {name !== null && name !== user.name ? <Button small title="Enregistrer le nom" onPress={() => saveName.mutate()} loading={saveName.isPending} /> : null}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.title}>Téléphone</Text>
        {user.phone ? (
          <View style={styles.row}>
            <Text style={styles.value}>{user.phone}</Text>
            <VerifiedBadge verified={user.phoneVerified} />
          </View>
        ) : (
          <Text style={styles.meta}>Aucun numéro. Ajoutez-en un pour vous connecter par SMS.</Text>
        )}
        {editing === 'sms' ? (
          <>
            <PhoneField label="Nouveau numéro" country={country} onCountryChange={setCountry} value={phone} onChangeText={setPhone} autoFocus />
            {passwordConfirm('sms')}
            <Button small title="Recevoir un code de confirmation" onPress={() => sendVerification.mutate({ channel: 'sms', destination: phone })} loading={sendVerification.isPending} />
          </>
        ) : (
          <View style={styles.actions}>
            {user.phone && !user.phoneVerified ? (
              <Button small variant="secondary" title="Vérifier" onPress={() => sendVerification.mutate({ channel: 'sms', destination: user.phone! })} loading={sendVerification.isPending} />
            ) : null}
            <Button small variant="ghost" title={user.phone ? 'Changer de numéro' : 'Ajouter un numéro'} onPress={() => setEditing('sms')} />
          </View>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.title}>E-mail</Text>
        {user.email ? (
          <View style={styles.row}>
            <Text style={styles.value}>{user.email}</Text>
            <VerifiedBadge verified={user.emailVerified} />
          </View>
        ) : (
          <Text style={styles.meta}>Aucun e-mail. Ajoutez-en un pour recevoir vos codes par e-mail.</Text>
        )}
        {editing === 'email' ? (
          <>
            <Field label="Nouvel e-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" autoFocus />
            {passwordConfirm('email')}
            <Button small title="Recevoir un code de confirmation" onPress={() => sendVerification.mutate({ channel: 'email', destination: email })} loading={sendVerification.isPending} />
          </>
        ) : (
          <View style={styles.actions}>
            {user.email && !user.emailVerified ? (
              <Button small variant="secondary" title="Vérifier" onPress={() => sendVerification.mutate({ channel: 'email', destination: user.email! })} loading={sendVerification.isPending} />
            ) : null}
            <Button small variant="ghost" title={user.email ? 'Changer d’e-mail' : 'Ajouter un e-mail'} onPress={() => setEditing('email')} />
          </View>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.title}>{user.hasPassword ? 'Changer le mot de passe' : 'Ajouter un mot de passe'}</Text>
        {!user.hasPassword ? <Text style={styles.meta}>Votre compte a été créé par code. Un mot de passe permet aussi de vous connecter sans code.</Text> : null}
        {user.hasPassword ? <Field label="Mot de passe actuel" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoComplete="current-password" /> : null}
        <Field label="Nouveau mot de passe (8 caractères minimum)" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" />
        <Button small title="Enregistrer le mot de passe" onPress={() => savePassword.mutate()} loading={savePassword.isPending} disabled={newPassword.length < 8} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  card: { gap: spacing.md },
  title: { fontWeight: '800', fontSize: 15, color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  value: { fontSize: 15, color: colors.text, fontWeight: '600', flexShrink: 1 },
  meta: { color: colors.textSecondary, fontSize: 13 },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
