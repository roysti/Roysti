import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, type IconName } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { confirm } from '@/lib/confirm';
import { formatCny, useMoney } from '@/lib/money';
import { useMe, useSession } from '@/lib/session';

type Href = Parameters<typeof router.push>[0];

function Shortcut({ icon, label, href, count }: { icon: IconName; label: string; href: Href; count?: number }) {
  return (
    <Pressable style={styles.shortcut} onPress={() => router.push(href)}>
      <View>
        <Ionicons name={icon} size={24} color={colors.text} />
        {count ? (
          <View style={styles.count}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.shortcutText}>{label}</Text>
    </Pressable>
  );
}

function MenuRow({ icon, label, href, detail }: { icon: IconName; label: string; href: Href; detail?: string }) {
  return (
    <Pressable style={styles.menuRow} onPress={() => router.push(href)}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <Text style={styles.menuLabel}>{label}</Text>
      {detail ? <Text style={styles.menuDetail}>{detail}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function AccountScreen() {
  const { token, signOut, currency } = useSession();
  const me = useMe();
  const { convert } = useMoney();
  const s = me.data?.summary;

  return (
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={me.isRefetching} onRefresh={() => me.refetch()} />}>
      {token && me.data ? (
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{me.data.user.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: '#fff' }]}>{me.data.user.name}</Text>
            <Text style={styles.profileEmail}>{me.data.user.phone ?? me.data.user.email}</Text>
          </View>
          <Pressable style={styles.balance} onPress={() => router.push('/wallet')}>
            <Text style={styles.balanceLabel}>Solde</Text>
            <Text style={styles.balanceValue}>{formatCny(me.data.user.balance)}</Text>
            {convert(me.data.user.balance) ? <Text style={styles.balanceConv}>≈ {convert(me.data.user.balance)}</Text> : null}
          </Pressable>
        </View>
      ) : (
        <Card style={{ gap: spacing.md, alignItems: 'center' }}>
          <Text style={styles.name}>Bienvenue sur Roysti</Text>
          <Text style={styles.email}>Connectez-vous pour acheter sur Taobao, 1688, Alibaba…</Text>
          <Button title="Se connecter / Créer un compte" icon="log-in-outline" onPress={() => router.push('/login')} />
        </Card>
      )}

      {token ? (
        <>
          <Card style={styles.block}>
            <Pressable style={styles.blockHeader} onPress={() => router.push('/orders')}>
              <Text style={styles.blockTitle}>Mes commandes</Text>
              <Text style={styles.link}>Tout voir ›</Text>
            </Pressable>
            <View style={styles.shortcuts}>
              <Shortcut icon="card-outline" label="À payer" href={{ pathname: '/orders', params: { status: 'pending_payment' } }} count={s?.ordersPendingPayment} />
              <Shortcut icon="bag-handle-outline" label="En cours" href={{ pathname: '/orders', params: { status: 'in_progress' } }} count={s?.ordersInProgress} />
              <Shortcut icon="cube-outline" label="Entrepôt" href="/warehouse" count={s?.warehouseItems} />
              <Shortcut icon="airplane-outline" label="Colis" href="/parcels" count={(s?.parcelsPendingPayment ?? 0) + (s?.parcelsInTransit ?? 0)} />
            </View>
          </Card>

          <Card style={styles.menu}>
            <MenuRow
              icon="shield-checkmark-outline"
              label="Profil et sécurité"
              href="/profile"
              detail={me.data && ((me.data.user.phone && !me.data.user.phoneVerified) || (me.data.user.email && !me.data.user.emailVerified)) ? 'À vérifier' : undefined}
            />
            <MenuRow icon="wallet-outline" label="Portefeuille et recharges" href="/wallet" />
            <MenuRow icon="location-outline" label="Adresses de livraison" href="/addresses" />
            <MenuRow icon="pricetags-outline" label="Coupons" href="/coupons" />
            <MenuRow icon="heart-outline" label="Favoris" href="/favorites" />
            <MenuRow icon="notifications-outline" label="Notifications" href="/notifications" detail={s?.unreadNotifications ? `${s.unreadNotifications} non lue(s)` : undefined} />
            <MenuRow icon="swap-horizontal-outline" label="Transfert de colis (achat par vous-même)" href="/forwarding" />
          </Card>
        </>
      ) : null}

      <Card style={styles.menu}>
        <MenuRow icon="calculator-outline" label="Estimer les frais de port" href="/estimate" />
        <MenuRow icon="help-circle-outline" label="Comment ça marche / FAQ" href="/help" />
        <MenuRow icon="settings-outline" label="Réglages" href="/settings" detail={currency} />
      </Card>

      {token ? (
        <Button title="Se déconnecter" variant="ghost" icon="log-out-outline" onPress={() => confirm('Se déconnecter ?', 'Vous pourrez vous reconnecter à tout moment.', () => signOut())} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '900', color: colors.primary },
  name: { fontSize: 17, fontWeight: '800', color: colors.text },
  email: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  profileEmail: { fontSize: 13, color: '#FFE3D6' },
  balance: { alignItems: 'flex-end' },
  balanceLabel: { color: '#FFE3D6', fontSize: 12 },
  balanceValue: { color: '#fff', fontSize: 18, fontWeight: '900' },
  balanceConv: { color: '#FFE3D6', fontSize: 11 },
  block: { gap: spacing.md },
  blockHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  blockTitle: { fontWeight: '800', fontSize: 15, color: colors.text },
  link: { color: colors.textSecondary, fontSize: 13 },
  shortcuts: { flexDirection: 'row' },
  shortcut: { flex: 1, alignItems: 'center', gap: 6 },
  shortcutText: { fontSize: 12, color: colors.text },
  count: { position: 'absolute', top: -6, right: -10, backgroundColor: colors.primary, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  countText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  menu: { paddingVertical: spacing.xs },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  menuLabel: { flex: 1, color: colors.text, fontSize: 14 },
  menuDetail: { color: colors.textMuted, fontSize: 12 },
});
