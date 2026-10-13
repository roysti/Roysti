import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DemoBanner } from '@/components/blocks';
import { Price } from '@/components/Price';
import { PlatformTag } from '@/components/ProductCard';
import { ProductImage } from '@/components/ProductImage';
import { Button, Card, Checkbox, Divider, ErrorView, Field, Loading, Notice, QuantityStepper, Row } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { PLATFORM_NAMES } from '@/lib/labels';
import { formatCny, useMoney } from '@/lib/money';
import { useMeta, useSession } from '@/lib/session';
import type { CartItem, Favorite, Platform, ProductDetail, Sku } from '@/lib/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Même règle que le serveur : palier de prix de gros appliqué au prix de base, écart du SKU conservé. */
function unitPrice(product: ProductDetail, sku: Sku | undefined, quantity: number) {
  const base = sku?.price ?? product.price;
  const tier = [...(product.priceTiers ?? [])].sort((a, b) => b.minQty - a.minQty).find((t) => quantity >= t.minQty);
  return tier ? round2(Math.max(0.01, base - product.price + tier.price)) : base;
}

export default function ProductScreen() {
  const { platform, itemId } = useLocalSearchParams<{ platform: Platform; itemId: string }>();
  const { width } = useWindowDimensions();
  const { token } = useSession();
  const meta = useMeta();
  const { convert } = useMoney();
  const queryClient = useQueryClient();

  const product = useQuery({ queryKey: ['product', platform, itemId], queryFn: () => api<ProductDetail>(`/products/${platform}/${itemId}`) });
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: () => api<Favorite[]>('/favorites'), enabled: !!token });

  const [selection, setSelection] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState<number | null>(null);
  const [remark, setRemark] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [imageIndex, setImageIndex] = useState(0);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const p = product.data;
  const qty = quantity ?? p?.moq ?? 1;
  const sku = useMemo(() => (p && p.props.length ? p.skus.find((s) => p.props.every((prop) => s.props[prop.pid] === selection[prop.pid])) : undefined), [p, selection]);
  const allSelected = !!p && p.props.every((prop) => selection[prop.pid]);
  const stock = sku?.stock ?? (p && !p.props.length ? p.stock : undefined);
  const itemServices = meta.data?.valueAddedServices.filter((s) => s.scope === 'item') ?? [];
  const isFavorite = !!favorites.data?.some((f) => f.productId === p?.id);

  const addToCart = useMutation({
    mutationFn: () => api<CartItem>('/cart', { body: { platform, itemId, selection, quantity: qty, remark, services } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: () =>
      isFavorite ? api(`/favorites/${encodeURIComponent(p!.id)}`, { method: 'DELETE' }) : api('/favorites', { body: { platform, itemId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });

  if (product.isLoading) return <Loading label="Chargement de l’article…" />;
  if (product.error || !p) return <ErrorView message={errorMessage(product.error)} onRetry={() => product.refetch()} />;

  const isAvailable = (pid: string, vid: string) => {
    const candidate = { ...selection, [pid]: vid };
    return p.skus.some((s) => s.stock > 0 && Object.entries(candidate).every(([k, v]) => s.props[k] === v));
  };

  const price = unitPrice(p, sku, qty);
  const itemsTotal = round2(price * qty);
  const feeRate = meta.data?.fees.serviceFeeRate[p.platform] ?? 0;
  const serviceFee = round2(itemsTotal * feeRate);
  const servicesTotal = itemServices.filter((s) => services.includes(s.id)).reduce((sum, s) => sum + s.price, 0);
  const total = round2(itemsTotal + p.domesticShipping + serviceFee + servicesTotal);

  const submit = async (buyNow: boolean) => {
    setMessage(null);
    if (!token) {
      router.push('/login');
      return;
    }
    if (!allSelected) {
      setMessage({ tone: 'danger', text: 'Choisissez toutes les options avant de continuer.' });
      return;
    }
    try {
      const item = await addToCart.mutateAsync();
      if (buyNow) router.push({ pathname: '/checkout', params: { ids: item.id } });
      else setMessage({ tone: 'success', text: 'Ajouté au panier ✔' });
    } catch (e) {
      setMessage({ tone: 'danger', text: errorMessage(e) });
    }
  };

  const images = p.images.length ? p.images : [p.image];
  const slideWidth = Math.min(width, 700);

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {p.isDemoData ? <DemoBanner /> : null}
        <View style={{ width: slideWidth, alignSelf: 'center' }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setImageIndex(Math.round(e.nativeEvent.contentOffset.x / slideWidth))}
            onScroll={(e) => setImageIndex(Math.round(e.nativeEvent.contentOffset.x / slideWidth))}
            scrollEventThrottle={64}>
            {images.map((uri) => (
              <View key={uri} style={{ width: slideWidth }}>
                <ProductImage uri={uri} rounded={0} />
              </View>
            ))}
          </ScrollView>
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {imageIndex + 1}/{images.length}
            </Text>
          </View>
        </View>

        <View style={styles.block}>
          <View style={styles.priceRow}>
            <Price cny={allSelected ? price : p.price} max={allSelected ? undefined : p.priceMax} size="lg" />
            <PlatformTag platform={p.platform} />
          </View>
          <Text style={styles.title} selectable>
            {p.title}
          </Text>
          {p.titleOriginal ? (
            <Text style={styles.original} selectable>
              {p.titleOriginal}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            {p.sales ? <Text style={styles.meta}>{p.sales.toLocaleString('fr-FR')} ventes</Text> : null}
            {p.location ? <Text style={styles.meta}>📍 {p.location}</Text> : null}
            <Text style={styles.meta}>Port Chine : {p.domesticShipping ? formatCny(p.domesticShipping) : 'gratuit'}</Text>
          </View>
          {p.priceTiers?.length ? (
            <View style={styles.tiers}>
              {p.priceTiers.map((t) => (
                <View key={t.minQty} style={[styles.tier, qty >= t.minQty && styles.tierActive]}>
                  <Text style={styles.tierPrice}>{formatCny(t.price)}</Text>
                  <Text style={styles.tierQty}>≥ {t.minQty} pcs</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <Card style={styles.card}>
          {p.props.map((prop) => (
            <View key={prop.pid} style={styles.prop}>
              <Text style={styles.propName}>
                {prop.name}
                {selection[prop.pid] ? <Text style={styles.propValue}> · {prop.values.find((v) => v.vid === selection[prop.pid])?.name}</Text> : null}
              </Text>
              <View style={styles.values}>
                {prop.values.map((v) => {
                  const active = selection[prop.pid] === v.vid;
                  const available = isAvailable(prop.pid, v.vid);
                  return (
                    <Pressable
                      key={v.vid}
                      disabled={!available}
                      onPress={() => setSelection((s) => ({ ...s, [prop.pid]: v.vid }))}
                      style={[styles.value, active && styles.valueActive, !available && styles.valueDisabled]}>
                      {v.image ? <ProductImage uri={v.image} style={styles.valueImage} rounded={4} /> : null}
                      <Text style={[styles.valueText, active && { color: colors.primary }, !available && { textDecorationLine: 'line-through' }]}>{v.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          <View style={styles.qtyRow}>
            <View>
              <Text style={styles.propName}>Quantité</Text>
              <Text style={styles.meta}>
                {stock !== undefined ? `${stock} en stock` : 'Choisissez les options'}
                {p.moq && p.moq > 1 ? ` · minimum ${p.moq}` : ''}
              </Text>
            </View>
            <QuantityStepper value={qty} onChange={setQuantity} min={p.moq ?? 1} max={stock || 99999} />
          </View>
          <Field label="Note pour l’acheteur (facultatif)" value={remark} onChangeText={setRemark} placeholder="Ex. : vérifier la couleur, retirer l’étiquette…" multiline />
        </Card>

        {itemServices.length ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Services de contrôle qualité</Text>
            <Text style={styles.meta}>{meta.data?.qc.freePhotos ?? 3} photos QC offertes à l’arrivée en entrepôt.</Text>
            {itemServices.map((s) => (
              <View key={s.id} style={styles.serviceRow}>
                <Checkbox checked={services.includes(s.id)} onPress={() => setServices((list) => (list.includes(s.id) ? list.filter((x) => x !== s.id) : [...list, s.id]))} label={s.name} />
                <Text style={styles.servicePrice}>{formatCny(s.price)}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Estimation du coût</Text>
          <Row label={`Articles (${qty} × ${formatCny(price)})`} value={formatCny(itemsTotal)} />
          <Row label="Port intérieur Chine" value={formatCny(p.domesticShipping)} />
          <Row label={`Frais de service (${Math.round(feeRate * 100)} %)`} value={formatCny(serviceFee)} />
          {servicesTotal ? <Row label="Services QC" value={formatCny(servicesTotal)} /> : null}
          <Divider />
          <Row label="Total à payer maintenant" value={formatCny(total)} strong />
          {convert(total) ? <Row label="Soit environ" value={convert(total)!} muted /> : null}
          <Notice>L’expédition internationale se paie plus tard, quand vous envoyez votre colis depuis l’entrepôt (poids réel mesuré).</Notice>
          {p.sensitive ? <Notice tone="warning">Article sensible (batterie/liquide) : seules certaines lignes d’expédition l’acceptent.</Notice> : null}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Vendeur</Text>
          <Row label="Boutique" value={p.seller.name} />
          {p.seller.rating ? <Row label="Note" value={`★ ${p.seller.rating.toFixed(2)} / 5`} /> : null}
          {p.seller.years ? <Row label="Ancienneté" value={`${p.seller.years} an(s)`} /> : null}
          <Pressable style={styles.sourceLink} onPress={() => Linking.openURL(p.sourceUrl)}>
            <Ionicons name="open-outline" size={16} color={colors.info} />
            <Text style={styles.sourceText}>Voir l’annonce d’origine sur {PLATFORM_NAMES[p.platform]}</Text>
          </Pressable>
        </Card>

        {p.attributes.length ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Caractéristiques</Text>
            {p.attributes.map((a) => (
              <Row key={`${a.name}-${a.value}`} label={a.name} value={a.value} />
            ))}
          </Card>
        ) : null}

        {p.descriptionImages.length ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Description</Text>
            {p.descriptionText ? <Text style={styles.meta}>{p.descriptionText}</Text> : null}
            {p.descriptionImages.map((uri) => (
              <ProductImage key={uri} uri={uri} style={{ marginTop: spacing.sm }} />
            ))}
          </Card>
        ) : null}
      </ScrollView>

      {message ? (
        <View style={styles.toast}>
          <Notice tone={message.tone}>{message.text}</Notice>
        </View>
      ) : null}
      <View style={styles.footer}>
        <Pressable onPress={() => (token ? toggleFavorite.mutate() : router.push('/login'))} style={styles.fav} accessibilityLabel="Favori">
          <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={24} color={isFavorite ? colors.primary : colors.textSecondary} />
        </Pressable>
        <Button title="Au panier" icon="cart-outline" variant="secondary" style={{ flex: 1 }} loading={addToCart.isPending} onPress={() => submit(false)} />
        <Button title="Acheter" style={{ flex: 1 }} onPress={() => submit(true)} disabled={addToCart.isPending} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  counter: { position: 'absolute', right: spacing.md, bottom: spacing.md, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  block: { backgroundColor: colors.card, padding: spacing.lg, gap: spacing.sm },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, lineHeight: 23 },
  original: { fontSize: 13, color: colors.textSecondary },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  meta: { fontSize: 12, color: colors.textSecondary },
  tiers: { flexDirection: 'row', gap: spacing.sm },
  tier: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  tierActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  tierPrice: { fontWeight: '800', color: colors.primary },
  tierQty: { fontSize: 11, color: colors.textSecondary },
  card: { marginHorizontal: spacing.md, marginTop: spacing.md, gap: spacing.sm },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  prop: { gap: spacing.sm },
  propName: { fontSize: 14, fontWeight: '700', color: colors.text },
  propValue: { fontWeight: '500', color: colors.textSecondary },
  values: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  value: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.card },
  valueActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  valueDisabled: { opacity: 0.4 },
  valueImage: { width: 24, height: 24 },
  valueText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  qtyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  servicePrice: { fontWeight: '700', color: colors.text },
  sourceLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: spacing.sm },
  sourceText: { color: colors.info, fontWeight: '600' },
  toast: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: 84 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  fav: { padding: spacing.sm },
});
