import * as Clipboard from 'expo-clipboard';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { AuthGate } from '@/components/blocks';
import { Button, Card, Field, Notice, Row } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { useMe, useMeta } from '@/lib/session';
import type { Order } from '@/lib/types';

export default function ForwardingScreen() {
  return (
    <AuthGate>
      <Forwarding />
    </AuthGate>
  );
}

function Forwarding() {
  const meta = useMeta();
  const me = useMe();
  const queryClient = useQueryClient();
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [value, setValue] = useState('');
  const [weight, setWeight] = useState('');
  const [copied, setCopied] = useState(false);

  const memberCode = me.data?.user.id.slice(0, 6).toUpperCase() ?? '……';
  const warehouse = meta.data?.warehouse;
  const recipient = `${warehouse?.recipient ?? ''} ${memberCode}`.trim();

  const submit = useMutation({
    mutationFn: () =>
      api<Order>('/forwarding', {
        body: {
          carrier,
          trackingNumber: tracking,
          description,
          quantity: Number(quantity) || 1,
          declaredValue: Number(value) || 0,
          weightKg: Number(weight) || undefined,
        },
      }),
    onSuccess: (order) => {
      queryClient.invalidateQueries();
      router.replace({ pathname: '/orders/[id]', params: { id: order.id } });
    },
  });

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>
        Vous avez acheté vous-même sur une plateforme chinoise ? Faites livrer à notre entrepôt, déclarez le numéro de suivi : nous réceptionnons, photographions et regroupons
        le colis avec vos autres achats.
      </Text>
      <Card style={{ gap: 4 }}>
        <Text style={styles.title}>1. Adresse de livraison à donner au vendeur</Text>
        <Row label="Destinataire" value={recipient} />
        <Row label="Téléphone" value={warehouse?.phone ?? '—'} />
        <Row label="Adresse" value={warehouse?.address ?? '—'} />
        <Notice>Ajoutez toujours votre code client « {memberCode} » au nom du destinataire pour que le colis soit identifié.</Notice>
        <Button
          small
          variant="secondary"
          title={copied ? 'Copié ✔' : 'Copier l’adresse'}
          onPress={async () => {
            await Clipboard.setStringAsync(`${recipient}\n${warehouse?.phone ?? ''}\n${warehouse?.address ?? ''}`);
            setCopied(true);
          }}
        />
      </Card>
      <Card style={{ gap: spacing.md }}>
        <Text style={styles.title}>2. Déclarer le colis</Text>
        <Field label="Transporteur (SF, YTO, ZTO, JD…)" value={carrier} onChangeText={setCarrier} />
        <Field label="Numéro de suivi" value={tracking} onChangeText={setTracking} autoCapitalize="characters" />
        <Field label="Contenu" value={description} onChangeText={setDescription} placeholder="Ex. : 2 paires de chaussures" />
        <Field label="Nombre d’articles" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
        <Field label="Valeur totale (CNY)" value={value} onChangeText={setValue} keyboardType="decimal-pad" />
        <Field label="Poids estimé (kg, facultatif)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
        {submit.error ? <Notice tone="danger">{errorMessage(submit.error)}</Notice> : null}
        <Button title="Déclarer le colis" icon="checkmark-circle-outline" onPress={() => submit.mutate()} loading={submit.isPending} disabled={!carrier || !tracking || !description} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  intro: { color: colors.textSecondary, lineHeight: 20 },
  title: { fontWeight: '800', color: colors.text, fontSize: 15, marginBottom: 4 },
});
