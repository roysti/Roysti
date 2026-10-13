# Analyse : Superbuy, CSSBuy et le modèle « agent d'achat »

Ce document résume ce que font Superbuy et CSSBuy, la façon dont ce type de service est construit, et comment l'application **Roysti** reproduit ces fonctionnalités.

> Une version Word de ce document, avec les formules en équations Word natives, se trouve dans [`Analyse-Superbuy-CSSBuy.docx`](./Analyse-Superbuy-CSSBuy.docx).

## 1. Méthode et limites

- Les sites officiels `superbuy.com` et `cssbuy.com` étaient **inaccessibles** depuis l'environnement de développement (connexion refusée par le proxy réseau). L'analyse repose donc sur des recherches web : pages d'aide officielles indexées (forum Superbuy, aide CSSBuy, guide de l'application Superbuy), fiches App Store, guides tiers et avis Trustpilot.
- Les chiffres (frais, durée de stockage, nombre de photos) **varient selon les sources** et changent souvent. Ils sont donnés avec leur source ; vérifiez-les sur les sites officiels avant de vous en servir.
- **Je ne sais pas** comment Superbuy et CSSBuy sont construits en interne (langages, hébergement, fournisseur de données produits) : aucune source publique fiable ne le décrit. La section 5 décrit les moyens techniques disponibles pour ce type de service, pas leur architecture réelle.

## 2. Le principe d'un agent d'achat

Taobao, Tmall, 1688, JD ou Weidian vendent surtout en Chine : interface en chinois, paiement chinois (Alipay…), livraison à une adresse chinoise. Un agent d'achat sert d'intermédiaire :

1. le client trouve un article (recherche ou lien collé) ;
2. il paie l'article, le port intérieur chinois et les frais de service ;
3. un acheteur de l'agent passe la commande chez le vendeur ;
4. le vendeur expédie à l'entrepôt de l'agent en Chine ;
5. l'entrepôt réceptionne, pèse et photographie l'article (photos « QC ») ;
6. le client regroupe ses articles dans un colis, choisit une ligne d'expédition et paie le fret international ;
7. l'agent emballe, pèse à nouveau, expédie et fournit un numéro de suivi.

Superbuy et CSSBuy suivent ce modèle en deux paiements (articles d'abord, expédition ensuite), selon les comparatifs consultés.

## 3. Fonctionnalités observées

| Fonction | Superbuy | CSSBuy | Roysti |
|---|---|---|---|
| Coller un lien produit | Oui, dans la barre de recherche | Oui, page « Shopping » ou fonction « Express » (aide officielle) | Oui, plus liens courts `m.tb.cn`, textes de partage, liens CSSBuy et Superbuy |
| Plateformes | Taobao, Tmall, JD, 1688, plateformes d'occasion (sources tierces) | Taobao surtout, 1688, Weidian (formats de liens `item-1688-…`, `item-micro-…`) | Taobao, Tmall, 1688, Alibaba, JD, Weidian |
| Recherche par mots-clés dans l'app | Non vérifié | Non vérifié | Oui, filtres plateforme, catégorie, prix, tri |
| Panier groupé par vendeur, paiement des articles et du port intérieur | Oui | Oui (« My Shopping Cart », aide officielle) | Oui |
| Délai de paiement d'une commande | 72 h (forum officiel) | Non trouvé | 72 h (paramétrable) |
| Statuts de commande | En attente de paiement → acheteur assigné → acheté → expédié (local) → reçu → arrivé → stocké (forum officiel) | Non détaillé dans les sources | En attente de paiement → payée → achetée → expédiée vers l'entrepôt → en entrepôt |
| Photos de contrôle qualité (QC) | Photos offertes (3 selon un comparatif), publiées sous 24 à 48 h selon des guides tiers | Photos QC ; retour au vendeur possible sous 7 jours (fiche App Store) | 3 photos offertes, photos supplémentaires, mesures, inspection, retour sous 7 jours |
| Stockage gratuit | 90 jours, puis 0,10 RMB par article et par jour, 180 jours maximum (sources tierces 2025-2026) | 90 jours (fiche App Store) | 90 jours, puis 0,10 CNY par article et par jour, 180 jours maximum (paramétrable) |
| Regroupement en colis | Oui | Oui (« Submit to Ship ») | Oui |
| Lignes d'expédition | Plus de 100 lignes (page d'accueil citée par un guide) | Lignes économiques (Css-FJ, Sea-Box), EMS, DHL (comparatif) | 6 lignes de démo : DHL, FedEx, EMS, ligne aérienne spéciale (articles sensibles), SAL, fret maritime |
| Poids volumétrique | Pratique standard des transporteurs | Idem | Oui, diviseur par ligne |
| Services d'emballage | Emballage personnalisé (source tierce) | Non détaillé | Retrait des emballages, papier bulle, angles, mise sous vide, carton renforcé, pré-emballage |
| Assurance colis | Non confirmé dans les sources | Non confirmé dans les sources | Oui : 3 % de la valeur déclarée, minimum 5 CNY |
| Pré-emballage (« rehearsal ») | Non trouvé | Non trouvé (Pandabuy le propose) | Oui, en service optionnel |
| Transfert de colis achetés par le client | Oui (« 中国转运解决方案 », solution de transfert, titre de l'app) | Non vérifié | Oui, avec code client |
| Frais de service | Sources contradictoires : 0 % sur Taobao/1688/JD, ou 10 RMB + 5 % par article | Non confirmé | 5 % par défaut, paramétrable par plateforme |
| Suivi en temps réel | Oui | Oui (fiche App Store) | Historique détaillé et notifications |
| Application mobile | iOS (App Store) ; Android non vérifié | iOS (App Store) ; Android non vérifié | Expo (iOS, Android, web) |

### Points de vigilance relevés dans les avis

- Écart entre l'estimation du port et le montant final (poids réel, poids volumétrique). Roysti affiche l'estimation, puis régularise automatiquement la différence après la pesée réelle.
- Frais supplémentaires peu lisibles. Roysti détaille chaque ligne : articles, port intérieur, frais de service, services, fret, surcharge carburant, manutention, assurance, stockage.

## 4. Parcours dans Roysti

1. **Accueil** : recherche, bouton « Coller », raccourcis par plateforme, catégories, tendances.
2. **Fiche article** : galerie, prix en CNY et converti, titre traduit et titre chinois d'origine, options (couleur, taille…) avec stock par SKU, prix de gros par paliers (1688, Alibaba), quantité minimale, note pour l'acheteur, services QC, estimation du coût, vendeur, caractéristiques, lien vers l'annonce d'origine.
3. **Panier** : groupé par vendeur, sélection, quantités.
4. **Paiement** : code promo, solde du portefeuille, création d'une commande par vendeur.
5. **Commandes** : filtres par statut, frise d'étapes, historique.
6. **Entrepôt** : photos QC, poids, jours de stockage gratuit restants, photos supplémentaires, retour.
7. **Colis** : adresse, services d'emballage, assurance, articles sensibles, comparaison des lignes, paiement, suivi, régularisation après pesée.
8. **Outils** : estimateur de frais de port, transfert de colis, coupons, favoris, notifications, portefeuille, adresses, devise d'affichage.

## 5. Comment construire ce type de service

### 5.1 Données produits

Trois options existent pour afficher les articles et les prix des plateformes chinoises :

| Option | Description | Remarques |
|---|---|---|
| API officielle Taobao Open Platform / 1688 | Méthodes comme `taobao.item.get`, authentification AppKey/AppSecret, signature, quotas | Accès soumis à autorisation |
| Passerelles tierces (Onebound, TMAPI, OTCommerce/OTAPI…) | Méthodes `item_get` (fiche) et `item_search` (recherche) sur plusieurs plateformes, souvent avec traduction et conversion de prix | Service payant ; vérifier les conditions d'utilisation et la fiabilité |
| Extraction directe des pages (scraping) | Lecture des pages web | Déconseillé : contraire aux conditions d'utilisation des plateformes, fragile, souvent bloqué |

**Je ne sais pas** quelle option Superbuy ou CSSBuy utilisent. Roysti isole cette question derrière une interface `ProductProvider` :

- `mock` : catalogue de démonstration (52 produits déclinés en 172 annonces sur 6 plateformes), fonctionne sans clé ;
- `onebound` : adaptateur pour une passerelle de type Onebound. La correspondance des champs suit le format couramment documenté, mais **elle n'a pas pu être testée avec une vraie clé** : contrôlez une réponse brute avant la mise en production.

### 5.2 Les autres briques

| Brique | Rôle | Dans Roysti |
|---|---|---|
| Application mobile | Recherche, commandes, entrepôt, colis | Expo SDK 57, React Native, Expo Router, TanStack Query |
| API | Prix recalculés côté serveur, commandes, entrepôt, colis | Node.js, Express 5, TypeScript, validation Zod |
| Base de données | Comptes, commandes, colis, transactions | Mémoire + fichier JSON optionnel (à remplacer par PostgreSQL) |
| Paiement | Recharge du solde, paiement des commandes et du port | Portefeuille avec recharge simulée (à brancher sur Stripe, PayPal ou Mobile Money) |
| Taux de change | Conversion indicative des prix | Service public `open.er-api.com`, avec taux de secours approximatifs |
| Back-office | Acheteurs, réception, photos, emballage | Simulé par les routes `/api/demo/*` (bouton « Démo : simuler l'étape suivante ») |
| Transporteurs | Tarifs et suivi | Grille de démo paramétrable dans `backend/src/config.ts` |

### 5.3 Architecture de Roysti

```
┌───────────────────────┐   HTTPS/JSON   ┌──────────────────────────────┐
│ App mobile (Expo)     │ ─────────────▶ │ API Express (TypeScript)     │
│ iOS · Android · Web   │                │  ├─ routes catalogue / compte │
│ Expo Router, Query    │ ◀───────────── │  ├─ services commande/colis   │
└───────────────────────┘                │  ├─ calcul frais & port       │
                                          │  └─ ProductProvider ─┐        │
                                          └──────────────────────┼────────┘
                                                                 ▼
                                    mock (démo) │ Onebound │ TMAPI │ OTAPI │ API officielle
```

## 6. Formules de calcul

Notations : $L$, $l$, $h$ les dimensions du colis en cm ; $D$ le diviseur volumétrique de la ligne (5 000 ou 6 000) ; $W_{r}$ le poids réel en kg.

**Poids volumétrique**

$$W_{v} = \frac{L \times l \times h}{D}$$

**Poids facturé**

$$W_{f} = \max\left(W_{r},\ W_{v}\right)$$

**Nombre de tranches supplémentaires** (première tranche $W_0$, pas $s$)

$$n = \max\left(0,\ \left\lceil \frac{W_{f} - W_{0}}{s} \right\rceil\right)$$

**Fret** (prix de la première tranche $P_0$, prix d'une tranche $P_s$, multiplicateur de zone $z$)

$$F = \left(P_{0} + n \cdot P_{s}\right) \cdot z$$

**Total de l'expédition** (surcharge carburant $c$, manutention $M$, assurance $A$)

$$T = F \cdot (1 + c) + M + A$$

**Assurance** (taux $\tau$, valeur déclarée $V$)

$$A = \max\left(A_{\min},\ \tau \cdot V\right)$$

**Frais de service** (taux $r$, prix unitaires $p_i$, quantités $q_i$)

$$S = \max\left(S_{\min},\ r \cdot \sum_{i} p_{i}\, q_{i}\right)$$

**Frais de stockage** ($j$ jours en entrepôt, $J$ jours gratuits, $k$ coût par article et par jour)

$$C = \max\left(0,\ j - J\right) \cdot k$$

**Prix unitaire en gros** (palier $t$ atteint pour la quantité commandée, $p_{\text{SKU}}$ prix de l'option, $p_{\text{base}}$ prix de base)

$$p = p_{\text{SKU}} - p_{\text{base}} + p_{t}$$

### Exemple chiffré (tarifs de démonstration)

Colis de 2 kg, 50 × 40 × 30 cm, vers la France en DHL ($D = 5000$, $W_0 = 0{,}5$, $s = 0{,}5$, $P_0 = 210$, $P_s = 55$, $z = 1$, $c = 15\,\%$, $M = 8$) :

- $W_v = 60\,000 / 5\,000 = 12$ kg, donc $W_f = 12$ kg ;
- $n = \lceil (12 - 0{,}5) / 0{,}5 \rceil = 23$ ;
- $F = 210 + 23 \times 55 = 1\,475$ CNY ;
- $T = 1\,475 \times 1{,}15 + 8 = 1\,704{,}25$ CNY.

Ce cas est vérifié par un test automatique (`backend/test/pricing.test.ts`).

## 7. Avant une mise en production

1. Obtenir une clé chez un fournisseur de données et valider l'adaptateur sur des réponses réelles.
2. Traduire les titres et descriptions (API de traduction) ; la recherche par image est aussi un service courant chez les agents.
3. Remplacer le stockage en mémoire par PostgreSQL et ajouter des migrations.
4. Brancher un vrai prestataire de paiement, avec confirmation par webhook avant de créditer le solde.
5. Construire le back-office : file d'achats, réception, photos, emballage, pesée, étiquettes transporteurs.
6. Négocier les tarifs transporteurs et remplacer la grille de démo.
7. Notifications push (`expo-notifications`), builds iOS/Android avec EAS.
8. Cadre légal : conditions générales, protection des données (RGPD), règles douanières, refus des contrefaçons et des produits interdits.

## Sources

- Forum officiel Superbuy, statuts des commandes : <https://bbs.superbuy.com/forum.php?mod=viewthread&tid=220825&fid=86>
- Guide de l'application Superbuy : <https://www.superbuy.com/en/page/shopguidelines/>
- Centre d'aide Superbuy : <https://www.superbuy.com/en/page/help/>
- Aide CSSBuy, procédure d'achat : <https://www.cssbuy.com/help-43-what-is-the-purchasing-procedure.html>
- Fiche App Store CSSBuy : <https://apps.apple.com/app/id1318645179>
- Fiche App Store Superbuy : <https://apps.apple.com/br/app/superbuy%E4%B8%AD%E5%9B%BD%E8%BD%AC%E8%BF%90%E8%A7%A3%E5%86%B3%E6%96%B9%E6%A1%88/id943334345?l=en-GB>
- Frais Superbuy 2026 (tiers) : <https://www.aigcmkt.com/en/superbuy-fees-explained-2026.html>
- Revue Superbuy 2026 (tiers) : <https://chinaproxybuy.com/blog/superbuy-review-2026/>
- Haulkit, fiche Superbuy : <https://haulkit.app/agents/superbuy>
- Comparatif Extrabux : <https://www.extrabux.com/en/guide/8821813>
- Comparatif de calculateurs (Sugargoo) : <https://blog.sugargoo.com/sugargoo-superbuy-mulebuy-kakobuy-shipping-calculator/>
- Guide CSSBuy (Jadeship) : <https://www.jadeship.com/blog/post/how-to-order-from-cssbuy>
- Photos QC Superbuy (GeeseNest) : <https://www.geesenest.com/beginners-guide-how-to-see-qc-photos-on-superbuy/>
- Avis CSSBuy (Trustpilot) : <https://ca.trustpilot.com/review/www.cssbuy.com>
- Aide Pandabuy (service « rehearsal ») : <https://intercom.help/pandabuy/en/collections/5947081-q-a-for-parcels>
- API Taobao et 1688 (Alibaba Cloud) : <https://developer.aliyun.com/article/1735984>
- OTCommerce, documentation OT API : <https://otcommerce.com/key-payments/otapi-documentation/>
- TMAPI : <https://tmapi.top/>
- Onebound : <https://clawhub.ai/jeff2011eng/onebound-api>
