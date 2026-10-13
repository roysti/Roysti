import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthGate } from '@/components/blocks';
import { EmptyState, ErrorView, Loading } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/labels';
import type { AppNotification } from '@/lib/types';

export default function NotificationsScreen() {
  return (
    <AuthGate>
      <Notifications />
    </AuthGate>
  );
}

function Notifications() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['notifications'], queryFn: () => api<AppNotification[]>('/notifications') });

  useEffect(() => {
    if (list.data?.some((n) => !n.read)) {
      api('/notifications/read', { method: 'POST' }).then(() => queryClient.invalidateQueries({ queryKey: ['me'] }));
    }
  }, [list.data, queryClient]);

  if (list.isLoading) return <Loading />;
  if (list.error) return <ErrorView message={errorMessage(list.error)} onRetry={() => list.refetch()} />;

  const open = (link?: string) => {
    const [, kind, id] = link?.split('/') ?? [];
    if (kind === 'orders' && id) router.push({ pathname: '/orders/[id]', params: { id } });
    if (kind === 'parcels' && id) router.push({ pathname: '/parcels/[id]', params: { id } });
  };

  return (
    <FlatList
      data={list.data ?? []}
      keyExtractor={(n) => n.id}
      contentContainerStyle={styles.container}
      ListEmptyComponent={<EmptyState icon="notifications-outline" title="Aucune notification" />}
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => open(item.link)}>
          <View style={[styles.icon, !item.read && { backgroundColor: colors.primary }]}>
            <Ionicons name="notifications" size={16} color={item.read ? colors.textSecondary : '#fff'} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.card, padding: spacing.md, borderRadius: 12 },
  icon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '700', color: colors.text },
  body: { color: colors.textSecondary, fontSize: 13 },
  date: { color: colors.textMuted, fontSize: 11 },
});
