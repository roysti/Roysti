import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ErrorView, Loading } from '@/components/ui';
import { colors, platformColors, radius, spacing } from '@/constants/theme';
import { errorMessage } from '@/lib/api';
import { useMeta } from '@/lib/session';

export default function CategoriesScreen() {
  const meta = useMeta();
  if (meta.isLoading) return <Loading />;
  if (meta.error || !meta.data) return <ErrorView message={errorMessage(meta.error)} onRetry={() => meta.refetch()} />;

  return (
    <FlatList
      data={meta.data.categories}
      keyExtractor={(c) => c.id}
      numColumns={3}
      contentContainerStyle={styles.list}
      columnWrapperStyle={{ gap: spacing.sm }}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Par plateforme</Text>
          <View style={styles.platforms}>
            {meta.data.platforms.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.platform, { backgroundColor: platformColors[p.id] }]}
                onPress={() => router.push({ pathname: '/search', params: { platform: p.id } })}>
                <Text style={styles.platformText}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.title}>Par catégorie</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable style={styles.cell} onPress={() => router.push({ pathname: '/search', params: { category: item.id, title: item.name } })}>
          <Text style={styles.icon}>{item.icon}</Text>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  platforms: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  platform: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  platformText: { color: '#fff', fontWeight: '800' },
  cell: {
    flex: 1,
    maxWidth: '33%',
    aspectRatio: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  icon: { fontSize: 32 },
  name: { fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center' },
});
