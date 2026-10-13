# Roysti – agent d'achat mobile pour Taobao, 1688, Alibaba…

Application mobile inspirée de **Superbuy** et **CSSBuy** : on y cherche ou colle un lien d'article chinois (Taobao, Tmall, 1688, Alibaba, JD, Weidian), on voit le prix, les options et les caractéristiques, on commande, on contrôle les photos en entrepôt, puis on regroupe ses achats dans un colis expédié à l'international.

- **Analyse des fonctionnalités** de Superbuy et CSSBuy, des moyens techniques et des formules : [`docs/ANALYSE.md`](docs/ANALYSE.md) (version Word avec équations : [`docs/Analyse-Superbuy-CSSBuy.docx`](docs/Analyse-Superbuy-CSSBuy.docx))
- **Application mobile** : [`mobile/`](mobile) – Expo SDK 57, React Native, Expo Router (iOS, Android, web)
- **API** : [`backend/`](backend) – Node.js, Express 5, TypeScript

| Accueil | Recherche | Fiche article | Panier |
|---|---|---|---|
| ![Accueil](docs/screenshots/01-home.png) | ![Recherche](docs/screenshots/02-search.png) | ![Fiche](docs/screenshots/04-product-options.png) | ![Panier](docs/screenshots/05-cart.png) |
| **Entrepôt (photos QC)** | **Création de colis** | **Suivi du colis** | **Estimateur de port** |
| ![Entrepôt](docs/screenshots/09-warehouse.png) | ![Colis](docs/screenshots/11-new-parcel.png) | ![Suivi](docs/screenshots/12-parcel.png) | ![Estimation](docs/screenshots/13-estimate.png) |

> ⚠️ Par défaut, l'application tourne sur un **catalogue de démonstration** (produits, prix et vendeurs fictifs), signalé par un bandeau jaune. Pour afficher les vrais articles, il faut une clé chez un fournisseur de données (voir [Données réelles](#données-réelles)).

## Tester l'APK Android

**Téléchargement direct (sans compte GitHub) : <https://github.com/roysti/Roysti/releases/latest/download/Roysti.apk>** – toutes les versions : <https://github.com/roysti/Roysti/releases>

1. Ouvrez le lien sur le téléphone Android et téléchargez `Roysti.apk`.
2. Ouvrez le fichier ; si Android le demande, autorisez « Installer des applications inconnues » pour votre navigateur.
3. Lancez Roysti, puis **Compte → Se connecter → « Utiliser le compte démo »**.

L'APK fonctionne **seul, sans serveur** : la logique du backend est embarquée dans l'application (mode « intégré »), avec le catalogue de démonstration et vos données (compte, commandes, colis) enregistrées sur le téléphone. **Compte → Réglages** permet de basculer vers un serveur Roysti distant ou de réinitialiser les données.

L'APK est compilé automatiquement par GitHub Actions ([`.github/workflows/android-apk.yml`](.github/workflows/android-apk.yml)) à chaque modification de `mobile/` ou `backend/src/`. C'est un build de test signé avec la clé de debug d'Expo, pour téléphones ARM (arm64-v8a, armeabi-v7a), Android 7.0 ou plus récent ; une publication sur le Play Store demandera une clé de signature dédiée.

## Fonctionnalités

**Trouver un article**
- Recherche multi-plateformes en français ou en chinois, filtres (plateforme, catégorie, prix) et tri (pertinence, ventes, prix).
- Collage de lien : Taobao, Tmall, 1688, Alibaba, JD, Weidian, liens courts `m.tb.cn`, textes de partage « 【淘宝】… », liens CSSBuy et Superbuy.
- Fiche article : galerie, prix en CNY et converti dans votre devise, titre traduit et titre chinois d'origine, options (couleur, taille…) avec stock par SKU, **prix de gros par paliers** et quantité minimale (1688, Alibaba), vendeur, caractéristiques, lien vers l'annonce d'origine.

**Acheter**
- Panier groupé par vendeur, note pour l'acheteur, services QC (photos supplémentaires, mesures, inspection).
- Une commande par vendeur ; paiement par le solde du portefeuille ; codes promo.
- Suivi des commandes : à payer → payée → achetée → expédiée vers l'entrepôt → en entrepôt.

**Entrepôt et expédition**
- Photos de contrôle qualité, poids mesuré, jours de stockage gratuit restants, retour au vendeur sous 7 jours.
- Création de colis : adresse, services d'emballage (retrait des boîtes, mise sous vide, papier bulle, carton renforcé, pré-emballage), assurance, articles sensibles, comparaison des lignes (DHL, FedEx, EMS, ligne spéciale, SAL, maritime).
- Calcul du poids volumétrique et du poids facturé, régularisation automatique après la pesée réelle, numéro de suivi.
- Transfert de colis achetés par vous-même (avec code client), estimateur de frais de port.

**Compte** : portefeuille et recharges, adresses, coupons, favoris, notifications, devise d'affichage (EUR, USD, MGA, XOF, CAD…).

## Démarrage rapide (développement)

Prérequis : Node.js 20 ou plus récent.

```bash
# 1. API (port 4000)
cd backend
npm install
npm run dev

# 2. Application mobile (dans un autre terminal)
cd mobile
npm install
npx expo start          # puis scanner le QR code avec Expo Go, ou touche « w » pour le web
```

Compte de démonstration : **demo@roysti.app / demo1234** (bouton « Utiliser le compte démo » sur l'écran de connexion).

Par défaut, l'application utilise l'**API intégrée** : elle fonctionne sans démarrer le backend. Pour utiliser le serveur à la place, choisissez « Serveur Roysti » dans **Compte → Réglages** (l'adresse par défaut est l'IP de l'ordinateur qui fait tourner Expo, port 4000), ou compilez avec `EXPO_PUBLIC_API_URL` (ex. `http://192.168.1.20:4000/api`), ce qui active le mode serveur.

En mode démo, le bouton **« Démo : simuler l'étape suivante »** sur une commande ou un colis joue le rôle de l'équipe d'achat et de l'entrepôt (achat, réception avec photos, emballage, pesée, expédition).

## Configuration de l'API

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `4000` | Port HTTP |
| `PRODUCT_PROVIDER` | `mock` | `mock` (catalogue de démo) ou `onebound` |
| `ONEBOUND_KEY`, `ONEBOUND_SECRET` | – | Identifiants du fournisseur Onebound |
| `DEMO_MODE` | `true` | Active les routes `/api/demo/*` et le compte démo |
| `DATA_FILE` | – | Fichier JSON de persistance (sinon tout est en mémoire) |
| `RATES_URL` | `https://open.er-api.com/v6/latest/CNY` | Service de taux de change |
| `RATES_OFFLINE` | `false` | `true` = taux de secours approximatifs uniquement |
| `WAREHOUSE_RECIPIENT`, `WAREHOUSE_ADDRESS`, `WAREHOUSE_PHONE` | « À configurer » | Adresse de l'entrepôt affichée pour les transferts |

Les frais de service, la durée de stockage, les services à valeur ajoutée, l'assurance et la grille des lignes d'expédition se règlent dans [`backend/src/config.ts`](backend/src/config.ts). **Ce sont des valeurs de démonstration**, pas les tarifs de Superbuy ou de CSSBuy.

## Données réelles

L'API ne dépend que de l'interface `ProductProvider` ([`backend/src/providers/types.ts`](backend/src/providers/types.ts)) :

- `mock` : 52 produits déclinés en 172 annonces sur 6 plateformes, sans clé ;
- `onebound` : adaptateur pour une passerelle de type Onebound (`item_get`, `item_search`). **Il n'a pas pu être testé avec une vraie clé** : contrôlez une réponse brute et ajustez `mapItem` si besoin.

D'autres fournisseurs (TMAPI, OTCommerce/OTAPI, API officielle Taobao Open Platform) se branchent en implémentant les deux méthodes `search` et `getProduct`. L'extraction directe des pages des plateformes est déconseillée (conditions d'utilisation, blocages).

## API

| Méthode et route | Rôle |
|---|---|
| `GET /api/meta` | Plateformes, catégories, pays, lignes, services, frais |
| `GET /api/rates` | Taux de change depuis le CNY |
| `GET /api/products/search?q=&platform=&category=&sort=&page=` | Recherche |
| `GET /api/products/featured` | Tendances |
| `GET /api/products/:platform/:itemId` | Fiche article |
| `POST /api/links/parse` | Lien ou texte de partage → plateforme + identifiant |
| `POST /api/shipping/estimate` | Devis toutes lignes |
| `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/me` | Compte |
| `GET/POST /api/cart`, `PATCH/DELETE /api/cart/:id` | Panier |
| `POST /api/orders/checkout`, `POST /api/orders/pay`, `GET /api/orders`, `POST /api/orders/:id/cancel` | Commandes |
| `GET /api/warehouse`, `POST /api/warehouse/:id/photos`, `POST /api/warehouse/:id/return` | Entrepôt |
| `POST /api/parcels/quote`, `POST /api/parcels`, `POST /api/parcels/:id/pay`, `GET /api/parcels/:id` | Colis |
| `POST /api/forwarding` | Transfert de colis |
| `GET /api/wallet`, `POST /api/wallet/topup` | Portefeuille |
| `/api/addresses`, `/api/coupons`, `/api/favorites`, `/api/notifications` | Compte |
| `POST /api/demo/orders/:id/advance`, `POST /api/demo/parcels/:id/advance` | Simulation entrepôt (mode démo) |

Les prix sont toujours recalculés côté serveur à partir du fournisseur : le prix envoyé par l'application est ignoré.

### Architecture partagée

La table des routes et l'aiguillage vivent dans [`backend/src/core/api.ts`](backend/src/core/api.ts), sans dépendance à Express ni à Node :

- le serveur ([`backend/src/app.ts`](backend/src/app.ts)) n'est qu'un adaptateur HTTP autour de ce cœur ;
- l'application mobile exécute le même cœur directement dans Hermes ([`mobile/src/lib/local-api.ts`](mobile/src/lib/local-api.ts)). Metro l'embarque grâce à [`mobile/metro.config.js`](mobile/metro.config.js) ;
- les services propres à la plateforme sont injectés : crypto (`node:crypto` côté serveur, `expo-crypto` + `@noble/hashes` dans l'app) et persistance (fichier JSON ou AsyncStorage). Un test vérifie que le cœur n'importe aucun module Node.

## Tests et vérifications

```bash
cd backend && npm test && npm run typecheck   # 47 tests : liens, frais, port, parcours complet, cœur portable
cd mobile && npx tsc --noEmit && npx expo lint
```

Le parcours complet (recherche → fiche → panier → paiement → entrepôt → colis → expédition) a aussi été joué dans Chromium sur la version web de l'application, en mode intégré, sans serveur. Le bundle Android est compilé en bytecode Hermes à chaque build.

## Avant une mise en production

Clé fournisseur et traduction, base PostgreSQL, vrai prestataire de paiement (Stripe, PayPal, Mobile Money) avec webhooks, back-office pour les acheteurs et l'entrepôt, tarifs transporteurs réels, notifications push, builds EAS, conditions générales, RGPD et règles douanières. Le détail est dans [`docs/ANALYSE.md`](docs/ANALYSE.md#7-avant-une-mise-en-production).
