import { Alert, Platform } from 'react-native';

/** Demande de confirmation multiplateforme (Alert natif, window.confirm sur le web). */
export function confirm(title: string, message: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Confirmer', onPress: onOk },
  ]);
}
