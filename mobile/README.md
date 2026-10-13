# Roysti – application mobile

Application Expo (SDK 57, React Native, Expo Router). Voir le [README principal](../README.md) pour la présentation et le démarrage de l'API.

```bash
npm install
npx expo start        # Expo Go (QR code), « a » Android, « i » iOS, « w » web
npx tsc --noEmit      # vérification des types
npx expo lint         # lint
```

- `EXPO_PUBLIC_API_URL` : adresse de l'API (par défaut, IP de la machine qui sert Metro, port 4000).
- Builds de production : `npx eas-cli@latest build` (voir la documentation EAS).

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
