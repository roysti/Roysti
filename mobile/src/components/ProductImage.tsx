import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { categoryTints, colors } from '@/constants/theme';

const CATEGORY_EMOJI: Record<string, string> = {
  women: '👗',
  men: '👔',
  shoes: '👟',
  bags: '👜',
  jewelry: '⌚',
  electronics: '🎧',
  phone: '📱',
  home: '🛋️',
  kitchen: '🍳',
  beauty: '💄',
  kids: '🧸',
  sport: '⚽',
  auto: '🚗',
  tools: '🔧',
  office: '✏️',
  wholesale: '📦',
};

function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Affiche l'image d'un article. Les URL « mock://catégorie/graine » du catalogue de démo
 * sont rendues comme des tuiles colorées ; les vraies URL (alicdn…) via expo-image.
 */
export function ProductImage({ uri, style, rounded = 12 }: { uri: string; style?: StyleProp<ViewStyle>; rounded?: number }) {
  if (!uri.startsWith('mock://')) {
    return <Image source={{ uri }} style={[styles.fill, { borderRadius: rounded }, style as object]} contentFit="cover" transition={150} />;
  }
  const [category = 'qc', seed = ''] = uri.slice('mock://'.length).split('/');
  const [bg, accent] = categoryTints[category] ?? categoryTints.qc!;
  const h = hash(seed);
  const isQc = category === 'qc';
  return (
    <View style={[styles.fill, { backgroundColor: bg, borderRadius: rounded }, style]}>
      <View style={[styles.blob, { backgroundColor: accent, left: `${(h % 50) - 10}%`, top: `${((h >> 3) % 50) - 10}%` }]} />
      {isQc ? (
        <View style={styles.center}>
          <Ionicons name="camera" size={26} color={colors.textSecondary} />
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={styles.emoji}>{CATEGORY_EMOJI[category] ?? '🛍️'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', aspectRatio: 1, overflow: 'hidden', backgroundColor: colors.background },
  blob: { position: 'absolute', width: '70%', height: '70%', borderRadius: 999, opacity: 0.55 },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 44 },
});
