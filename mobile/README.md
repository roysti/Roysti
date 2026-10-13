# Roysti – application mobile

Application Expo (SDK 57, React Native, Expo Router). Voir le [README principal](../README.md) pour la présentation et le démarrage de l'API.

```bash
npm install
npx expo start        # Expo Go (QR code), « a » Android, « i » iOS, « w » web
npx tsc --noEmit      # vérification des types
npx expo lint         # lint
```

- Par défaut, l'API est **intégrée** (`src/lib/local-api.ts`) : l'app exécute la logique de `../backend/src/core` sans serveur. `metro.config.js` embarque ce dossier.
- `EXPO_PUBLIC_API_URL` : adresse d'un serveur Roysti ; si elle est définie au build, l'app démarre en mode serveur (sinon, bascule dans Réglages).
- APK de test : compilé par GitHub Actions (`.github/workflows/android-apk.yml`), voir le [README principal](../README.md#tester-lapk-android). Pour un build local : `npx expo prebuild --platform android` puis `cd android && ./gradlew assembleRelease` (SDK Android, NDK 27.1 et JDK 17 requis).

## Structure

```
src/
  app/                 écrans (Expo Router)
    (tabs)/            Accueil, Catégories, Panier, Entrepôt, Compte
    product/[platform]/[itemId].tsx   fiche article
    search.tsx, link.tsx, checkout.tsx, orders/, parcels/, estimate.tsx, wallet.tsx…
  components/          UI réutilisable (cartes, prix, images, frises, visionneuse QC…)
  lib/                 client API, session, devises, libellés, types
  constants/theme.ts   couleurs et espacements
```
