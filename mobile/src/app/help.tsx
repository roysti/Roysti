import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, type IconName } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { formatCny } from '@/lib/money';
import { useMeta } from '@/lib/session';

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'search', title: 'Trouvez un article', text: 'Cherchez par mots-clés (français ou chinois) sur Taobao, Tmall, 1688, Alibaba, JD, Weidian, ou collez directement le lien d’une annonce.' },
  { icon: 'card', title: 'Payez l’article', text: 'Vous payez le prix de l’article, le port intérieur en Chine et nos frais de service. Nous achetons auprès du vendeur.' },
  { icon: 'camera', title: 'Contrôle qualité', text: 'À l’arrivée dans notre entrepôt, l’article est pesé et photographié. Vous validez ou demandez un retour.' },
  { icon: 'cube', title: 'Regroupez', text: 'Rassemblez plusieurs articles dans un seul colis pour réduire les frais de port. Choisissez emballage et assurance.' },
  { icon: 'airplane', title: 'Expédition', text: 'Choisissez la ligne (express, postale, économique, maritime), payez le port et suivez votre colis jusqu’à chez vous.' },
];

export default function HelpScreen() {
  const meta = useMeta();
  const m = meta.data;
  const [open, setOpen] = useState<number | null>(0);
  const faq = [
    {
      q: 'Combien coûte le service ?',
      a: `Frais de service de ${Math.round((m?.fees.serviceFeeRate.taobao ?? 0.05) * 100)} % du prix des articles. Le port international se paie séparément, à l’envoi du colis, selon le poids facturé et la ligne choisie.`,
    },
    {
      q: 'Combien de temps mes articles restent-ils en entrepôt ?',
      a: `Stockage gratuit ${m?.storage.freeDays ?? 90} jours, puis ${formatCny(m?.storage.feePerItemPerDay ?? 0.1)} par article et par jour, jusqu’à ${m?.storage.maxDays ?? 180} jours maximum.`,
    },
    {
      q: 'Qu’est-ce que les photos QC ?',
      a: `${m?.qc.freePhotos ?? 3} photos de contrôle qualité offertes par article à l’arrivée. Vous pouvez demander des photos supplémentaires, des mesures ou une inspection détaillée.`,
    },
    {
      q: 'Comment est calculé le poids facturé ?',
      a: 'Le transporteur facture le plus grand entre le poids réel et le poids volumétrique (longueur × largeur × hauteur en cm ÷ 5 000 ou 6 000 selon la ligne). Retirer les boîtes ou mettre sous vide réduit souvent le prix.',
    },
    {
      q: 'Puis-je retourner un article ?',
      a: 'Oui, dans les 7 jours suivant l’arrivée en entrepôt si l’article ne correspond pas. Le remboursement intervient après acceptation par le vendeur ; des frais de retour en Chine peuvent s’appliquer.',
    },
    {
      q: 'Quels articles sont interdits ?',
      a: 'Contrefaçons, armes, produits dangereux, stupéfiants, animaux et produits soumis à restriction dans votre pays. Les batteries, liquides et poudres ne passent que par certaines lignes.',
    },
    {
      q: 'Vais-je payer des droits de douane ?',
      a: 'Selon votre pays, des droits et taxes peuvent être demandés à la réception. Ils ne sont pas inclus dans les frais de port. Renseignez-vous sur les règles de votre douane.',
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {STEPS.map((s, i) => (
        <View key={s.title} style={styles.step}>
          <View style={styles.stepIcon}>
            <Ionicons name={s.icon} size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>
              {i + 1}. {s.title}
            </Text>
            <Text style={styles.text}>{s.text}</Text>
          </View>
        </View>
      ))}
      <Text style={styles.section}>Questions fréquentes</Text>
      {faq.map((item, i) => (
        <Card key={item.q} style={{ paddingVertical: spacing.md }}>
          <Pressable style={styles.q} onPress={() => setOpen(open === i ? null : i)}>
            <Text style={styles.qText}>{item.q}</Text>
            <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
          </Pressable>
          {open === i ? <Text style={[styles.text, { marginTop: spacing.sm }]}>{item.a}</Text> : null}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  step: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.card, padding: spacing.md, borderRadius: 12 },
  stepIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontWeight: '800', color: colors.text, marginBottom: 2 },
  text: { color: colors.textSecondary, lineHeight: 19, fontSize: 13 },
  section: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: spacing.md },
  q: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  qText: { flex: 1, fontWeight: '700', color: colors.text },
});
