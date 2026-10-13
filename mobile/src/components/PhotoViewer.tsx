import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '@/constants/theme';
import { ProductImage } from './ProductImage';

/** Visionneuse plein écran des photos de contrôle qualité. */
export function PhotoViewer({ photos, title, onClose }: { photos: string[] | null; title?: string; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const slide = Math.min(width, 700);
  return (
    <Modal visible={!!photos} animationType="fade" onRequestClose={onClose} transparent>
      <SafeAreaView style={styles.backdrop}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title ?? 'Photos QC'} · {index + 1}/{photos?.length ?? 0}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Fermer">
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
        </View>
        <View style={{ width: slide, alignSelf: 'center', flex: 1, justifyContent: 'center' }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / slide))}
            scrollEventThrottle={64}>
            {(photos ?? []).map((uri) => (
              <View key={uri} style={{ width: slide, padding: spacing.md }}>
                <ProductImage uri={uri} />
              </View>
            ))}
          </ScrollView>
        </View>
        <Text style={styles.hint}>Vérifiez couleur, taille, défauts. En cas de problème, demandez un retour sous 7 jours.</Text>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, gap: spacing.md },
  title: { color: '#fff', fontWeight: '700', fontSize: 16, flex: 1 },
  hint: { color: '#ccc', textAlign: 'center', padding: spacing.lg, fontSize: 13 },
});
