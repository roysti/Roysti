import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { ProviderSettings } from '../../../backend/src/providers/index';

export type { ProviderSettings };

/**
 * Réglages du fournisseur d'articles du mode intégré (clé Onebound, jeton TMAPI…).
 * Les clés sont chiffrées par le système (Android Keystore) via expo-secure-store.
 * Sur le web (aperçu uniquement), SecureStore n'existe pas : repli sur AsyncStorage.
 */
const KEY = 'roysti.provider.v1';
export const DEMO_SETTINGS: ProviderSettings = { provider: 'mock' };

const secure = Platform.OS !== 'web';

export async function loadProviderSettings(): Promise<ProviderSettings> {
  try {
    const raw = secure ? await SecureStore.getItemAsync(KEY) : await AsyncStorage.getItem(KEY);
    if (!raw) return DEMO_SETTINGS;
    const parsed = JSON.parse(raw) as ProviderSettings;
    return parsed && typeof parsed.provider === 'string' ? parsed : DEMO_SETTINGS;
  } catch {
    return DEMO_SETTINGS;
  }
}

export async function saveProviderSettings(settings: ProviderSettings): Promise<void> {
  const raw = JSON.stringify(settings);
  if (secure) await SecureStore.setItemAsync(KEY, raw);
  else await AsyncStorage.setItem(KEY, raw);
}
