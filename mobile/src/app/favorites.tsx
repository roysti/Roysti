import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, View } from 'react-native';
import { AuthGate } from '@/components/blocks';
import { ProductCard } from '@/components/ProductCard';
import { EmptyState, ErrorView, Loading } from '@/components/ui';
import { spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import type { Favorite } from '@/lib/types';

export default function FavoritesScreen() {
  return (
    <AuthGate>
      <Favorites />
    </AuthGate>
  );
}

function Favorites() {
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: () => api<Favorite[]>('/favorites') });
  if (favorites.isLoading) return <Loading />;
  if (favorites.error) return <ErrorView message={errorMessage(favorites.error)} onRetry={() => favorites.refetch()} />;
  return (
    <FlatList
      data={favorites.data ?? []}
      keyExtractor={(f) => f.productId}
      numColumns={2}
      columnWrapperStyle={{ gap: spacing.sm }}
      contentContainerStyle={styles.container}
      ListEmptyComponent={<EmptyState icon="heart-outline" title="Aucun favori" message="Touchez le cœur sur une fiche article pour la retrouver ici." />}
      renderItem={({ item }) => (
        <View style={styles.cell}>
          <ProductCard product={{ ...item, id: item.productId, itemId: item.productId.split(':')[1] ?? '' }} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  cell: { flex: 1, maxWidth: '50%', marginBottom: spacing.sm },
});
