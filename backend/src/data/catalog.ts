/**
 * Catalogue de DÉMONSTRATION utilisé par le fournisseur « mock ».
 * Les produits, prix et vendeurs sont fictifs ; ils servent à faire tourner
 * l'application sans clé d'API. Branchez un vrai fournisseur (voir providers/)
 * pour afficher les articles réels de Taobao, 1688, Alibaba, etc.
 */
import type { Platform } from '../types.js';

export type PropTemplate = 'apparel' | 'shoes' | 'color' | 'phone' | 'capacity' | 'size' | 'none';

export interface BaseProduct {
  key: string;
  cat: string;
  zh: string;
  fr: string;
  /** Prix public indicatif sur Taobao, en CNY. */
  price: number;
  weightKg: number;
  /** Dimensions emballées (cm). */
  dims: [number, number, number];
  props: PropTemplate;
  platforms: Platform[];
  attrs: [string, string][];
  keywords?: string[];
  sensitive?: boolean;
}

export const BASE_PRODUCTS: BaseProduct[] = [
  // Mode femme
  { key: 'robe-fleurie', cat: 'women', zh: '法式碎花连衣裙女夏季新款收腰显瘦长裙', fr: 'Robe longue à fleurs style français, taille cintrée', price: 129, weightKg: 0.35, dims: [30, 25, 4], props: 'apparel', platforms: ['taobao', 'tmall', '1688', 'weidian'], attrs: [['Matière', 'Polyester 95 %, élasthanne 5 %'], ['Saison', 'Été'], ['Style', 'Romantique']] },
  { key: 'chemisier-satin', cat: 'women', zh: '缎面衬衫女长袖高级感垂感上衣', fr: 'Chemisier en satin manches longues, tombé fluide', price: 89, weightKg: 0.25, dims: [28, 22, 3], props: 'apparel', platforms: ['taobao', '1688'], attrs: [['Matière', 'Satin (polyester)'], ['Col', 'Col chemise'], ['Saison', 'Printemps / automne']] },
  { key: 'jean-large', cat: 'women', zh: '高腰阔腿牛仔裤女宽松直筒拖地裤', fr: 'Jean large taille haute coupe droite', price: 119, weightKg: 0.6, dims: [32, 26, 5], props: 'apparel', platforms: ['taobao', 'tmall', '1688'], attrs: [['Matière', 'Denim coton 98 %'], ['Coupe', 'Wide leg'], ['Taille', 'Haute']] },
  { key: 'doudoune-courte', cat: 'women', zh: '短款羽绒服女冬季白鸭绒加厚外套', fr: 'Doudoune courte en duvet de canard blanc', price: 399, weightKg: 0.9, dims: [40, 30, 12], props: 'apparel', platforms: ['taobao', 'tmall', 'jd'], attrs: [['Garnissage', 'Duvet de canard blanc 90 %'], ['Saison', 'Hiver'], ['Fermeture', 'Zip']] },
  { key: 'ensemble-sport-femme', cat: 'women', zh: '瑜伽服套装女速干健身服运动两件套', fr: 'Ensemble de yoga 2 pièces séchage rapide', price: 79, weightKg: 0.3, dims: [28, 22, 4], props: 'apparel', platforms: ['taobao', '1688', 'alibaba'], attrs: [['Matière', 'Nylon 75 %, élasthanne 25 %'], ['Usage', 'Yoga, fitness']] },
  // Mode homme
  { key: 'tshirt-coton', cat: 'men', zh: '重磅纯棉短袖T恤男宽松圆领打底衫', fr: 'T-shirt épais 100 % coton col rond coupe ample', price: 49, weightKg: 0.28, dims: [28, 22, 3], props: 'apparel', platforms: ['taobao', '1688', 'alibaba', 'weidian'], attrs: [['Matière', 'Coton 100 %, 260 g/m²'], ['Coupe', 'Oversize'], ['Col', 'Rond']], keywords: ['tee shirt', 'tshirt', 't-shirt'] },
  { key: 'chemise-lin', cat: 'men', zh: '亚麻衬衫男长袖休闲宽松夏季薄款', fr: 'Chemise en lin manches longues décontractée', price: 139, weightKg: 0.3, dims: [30, 24, 3], props: 'apparel', platforms: ['taobao', 'tmall'], attrs: [['Matière', 'Lin 55 %, coton 45 %'], ['Saison', 'Été']] },
  { key: 'veste-coupe-vent', cat: 'men', zh: '户外冲锋衣男防风防水三合一外套', fr: 'Veste coupe-vent imperméable 3-en-1', price: 299, weightKg: 1.1, dims: [40, 30, 10], props: 'apparel', platforms: ['taobao', 'tmall', 'jd', '1688'], attrs: [['Membrane', 'Imperméable 5000 mm'], ['Doublure', 'Polaire amovible']] },
  { key: 'pantalon-cargo', cat: 'men', zh: '工装裤男美式宽松直筒多口袋休闲裤', fr: 'Pantalon cargo multipoches coupe droite', price: 99, weightKg: 0.55, dims: [32, 26, 5], props: 'apparel', platforms: ['taobao', '1688', 'weidian'], attrs: [['Matière', 'Coton 100 %'], ['Poches', '6']] },
  { key: 'sweat-capuche', cat: 'men', zh: '连帽卫衣男秋冬加绒加厚纯色外套', fr: 'Sweat à capuche molletonné uni', price: 109, weightKg: 0.7, dims: [35, 28, 8], props: 'apparel', platforms: ['taobao', '1688', 'alibaba', 'weidian'], attrs: [['Matière', 'Coton 80 %, polyester 20 %'], ['Intérieur', 'Molleton gratté']], keywords: ['hoodie', 'pull'] },
  // Chaussures
  { key: 'baskets-blanches', cat: 'shoes', zh: '小白鞋男女百搭真皮板鞋休闲运动鞋', fr: 'Baskets blanches en cuir unisexes', price: 169, weightKg: 1.1, dims: [33, 22, 12], props: 'shoes', platforms: ['taobao', '1688', 'weidian'], attrs: [['Dessus', 'Cuir de vachette'], ['Semelle', 'Caoutchouc'], ['Origine', 'Putian / Quanzhou']], keywords: ['sneakers', 'basket'] },
  { key: 'running', cat: 'shoes', zh: '轻便跑步鞋男女透气减震网面运动鞋', fr: 'Chaussures de running légères amorti respirant', price: 199, weightKg: 0.9, dims: [33, 22, 12], props: 'shoes', platforms: ['taobao', 'tmall', 'jd', '1688'], attrs: [['Dessus', 'Mesh respirant'], ['Semelle', 'EVA amortissante']] },
  { key: 'bottines-chelsea', cat: 'shoes', zh: '切尔西靴男女真皮短靴英伦风马丁靴', fr: 'Bottines Chelsea en cuir style anglais', price: 259, weightKg: 1.4, dims: [34, 24, 13], props: 'shoes', platforms: ['taobao', 'tmall'], attrs: [['Dessus', 'Cuir pleine fleur'], ['Hauteur de tige', '15 cm']] },
  { key: 'sandales', cat: 'shoes', zh: '凉拖鞋男女夏季外穿厚底防滑拖鞋', fr: 'Claquettes semelle épaisse antidérapantes', price: 29, weightKg: 0.45, dims: [30, 12, 8], props: 'shoes', platforms: ['taobao', '1688', 'alibaba'], attrs: [['Matière', 'EVA'], ['Usage', 'Maison, plage']] },
  // Sacs
  { key: 'sac-dos-laptop', cat: 'bags', zh: '双肩包男大容量电脑包商务旅行背包', fr: 'Sac à dos ordinateur 15,6" grande capacité', price: 139, weightKg: 0.95, dims: [45, 32, 10], props: 'color', platforms: ['taobao', 'tmall', '1688', 'alibaba', 'jd'], attrs: [['Matière', 'Oxford imperméable'], ['Capacité', '35 L'], ['Port USB', 'Oui']] },
  { key: 'valise-cabine', cat: 'bags', zh: '行李箱20寸登机箱铝框万向轮拉杆箱', fr: 'Valise cabine 20" cadre aluminium roues 360°', price: 329, weightKg: 3.6, dims: [55, 38, 24], props: 'color', platforms: ['taobao', 'tmall', '1688', 'jd'], attrs: [['Coque', 'Polycarbonate'], ['Serrure', 'TSA'], ['Volume', '38 L']] },
  { key: 'sac-bandouliere', cat: 'bags', zh: '小众设计包包女斜挎包百搭腋下包', fr: 'Sac bandoulière femme design minimaliste', price: 89, weightKg: 0.5, dims: [28, 20, 10], props: 'color', platforms: ['taobao', '1688', 'weidian'], attrs: [['Matière', 'Cuir PU'], ['Fermeture', 'Magnétique']] },
  // Montres & bijoux
  { key: 'montre-quartz', cat: 'jewelry', zh: '简约石英手表男防水夜光钢带腕表', fr: 'Montre quartz minimaliste étanche bracelet acier', price: 159, weightKg: 0.2, dims: [12, 10, 8], props: 'color', platforms: ['taobao', '1688', 'alibaba'], attrs: [['Mouvement', 'Quartz japonais'], ['Étanchéité', '3 ATM'], ['Boîtier', '40 mm']] },
  { key: 'collier-argent', cat: 'jewelry', zh: '925纯银项链女锁骨链小众设计吊坠', fr: 'Collier en argent 925 pendentif minimaliste', price: 69, weightKg: 0.05, dims: [10, 8, 3], props: 'color', platforms: ['taobao', 'weidian', '1688'], attrs: [['Métal', 'Argent 925'], ['Longueur', '40 + 5 cm']] },
  { key: 'bague-titane', cat: 'jewelry', zh: '钛钢戒指男女情侣对戒不褪色', fr: 'Bague en acier titane ne noircit pas', price: 19, weightKg: 0.03, dims: [8, 8, 3], props: 'size', platforms: ['taobao', '1688', 'alibaba'], attrs: [['Métal', 'Acier titane 316L']] },
  // Électronique
  { key: 'ecouteurs-bt', cat: 'electronics', zh: '真无线蓝牙耳机降噪入耳式运动耳机', fr: 'Écouteurs Bluetooth sans fil à réduction de bruit', price: 129, weightKg: 0.15, dims: [12, 10, 5], props: 'color', platforms: ['taobao', 'tmall', 'jd', '1688', 'alibaba'], attrs: [['Bluetooth', '5.3'], ['Autonomie', '6 h (+24 h boîtier)'], ['Batterie', 'Lithium intégrée']], sensitive: true, keywords: ['écouteurs', 'airpods', 'earbuds'] },
  { key: 'casque-gaming', cat: 'electronics', zh: '头戴式游戏耳机电竞有线带麦RGB', fr: 'Casque gaming filaire avec micro RGB', price: 149, weightKg: 0.6, dims: [24, 20, 12], props: 'color', platforms: ['taobao', 'jd', '1688'], attrs: [['Connexion', 'USB + jack 3,5 mm'], ['Son', '7.1 virtuel']] },
  { key: 'enceinte-bt', cat: 'electronics', zh: '蓝牙音箱户外便携防水大音量低音炮', fr: 'Enceinte Bluetooth portable étanche', price: 99, weightKg: 0.7, dims: [20, 10, 10], props: 'color', platforms: ['taobao', 'tmall', '1688', 'alibaba'], attrs: [['Puissance', '20 W'], ['Étanchéité', 'IPX7'], ['Batterie', '3600 mAh']], sensitive: true },
  { key: 'montre-connectee', cat: 'electronics', zh: '智能手表运动心率血氧监测蓝牙通话', fr: 'Montre connectée sport cardio et appels Bluetooth', price: 199, weightKg: 0.2, dims: [12, 10, 6], props: 'color', platforms: ['taobao', 'jd', '1688', 'alibaba'], attrs: [['Écran', 'AMOLED 1,43"'], ['Autonomie', '7 jours'], ['Compatibilité', 'Android / iOS']], sensitive: true, keywords: ['smartwatch'] },
  { key: 'clavier-meca', cat: 'electronics', zh: '机械键盘有线热插拔青轴红轴RGB', fr: 'Clavier mécanique hot-swap rétroéclairé', price: 189, weightKg: 1, dims: [40, 16, 6], props: 'color', platforms: ['taobao', 'jd', '1688'], attrs: [['Switchs', 'Rouges / bleus'], ['Format', '75 %'], ['Connexion', 'USB-C']], keywords: ['keyboard'] },
  // Téléphone
  { key: 'coque-magsafe', cat: 'phone', zh: '磁吸手机壳透明防摔保护套', fr: 'Coque magnétique transparente antichoc', price: 25, weightKg: 0.06, dims: [18, 10, 2], props: 'phone', platforms: ['taobao', '1688', 'alibaba', 'weidian'], attrs: [['Matière', 'TPU + polycarbonate'], ['Aimants', 'Compatibles MagSafe']], keywords: ['coque', 'étui'] },
  { key: 'chargeur-gan', cat: 'phone', zh: '65W氮化镓充电器多口快充头', fr: 'Chargeur GaN 65 W multiports charge rapide', price: 89, weightKg: 0.15, dims: [10, 8, 5], props: 'color', platforms: ['taobao', 'tmall', 'jd', '1688', 'alibaba'], attrs: [['Puissance', '65 W'], ['Ports', '2 USB-C + 1 USB-A'], ['Prise', 'Européenne / US au choix']] },
  { key: 'powerbank', cat: 'phone', zh: '充电宝超薄小巧快充移动电源', fr: 'Batterie externe ultra-fine charge rapide', price: 79, weightKg: 0.3, dims: [15, 8, 3], props: 'capacity', platforms: ['taobao', 'tmall', 'jd', '1688'], attrs: [['Sortie', '22,5 W'], ['Cellules', 'Lithium polymère']], sensitive: true, keywords: ['batterie externe', 'power bank'] },
  { key: 'cable-usbc', cat: 'phone', zh: '编织数据线Type-C快充线1米2米', fr: 'Câble USB-C tressé charge rapide', price: 15, weightKg: 0.05, dims: [12, 10, 2], props: 'size', platforms: ['taobao', '1688', 'alibaba'], attrs: [['Puissance', '100 W'], ['Gaine', 'Nylon tressé']] },
  // Maison
  { key: 'lampe-chevet', cat: 'home', zh: '奶油风台灯卧室床头灯氛围灯', fr: "Lampe de chevet style crème lumière d'ambiance", price: 69, weightKg: 1.2, dims: [30, 20, 20], props: 'color', platforms: ['taobao', '1688', 'alibaba'], attrs: [['Ampoule', 'LED E27 incluse'], ['Variateur', '3 intensités']] },
  { key: 'rideaux-occultants', cat: 'home', zh: '全遮光窗帘卧室隔热成品窗帘布', fr: 'Rideaux occultants isolants prêts à poser', price: 59, weightKg: 1.5, dims: [35, 30, 8], props: 'size', platforms: ['taobao', '1688'], attrs: [['Occultation', '95 %'], ['Fixation', 'Œillets']] },
  { key: 'boites-rangement', cat: 'home', zh: '收纳箱家用衣服整理箱可折叠储物箱', fr: 'Boîtes de rangement pliables (lot de 3)', price: 45, weightKg: 1.8, dims: [40, 30, 10], props: 'color', platforms: ['taobao', '1688', 'alibaba'], attrs: [['Matière', 'Tissu non tissé'], ['Contenance', '3 × 45 L']] },
  // Cuisine
  { key: 'poele-antiadhesive', cat: 'kitchen', zh: '麦饭石不粘锅平底锅家用煎锅', fr: 'Poêle antiadhésive revêtement pierre 28 cm', price: 89, weightKg: 1.3, dims: [50, 30, 8], props: 'size', platforms: ['taobao', 'tmall', 'jd', '1688'], attrs: [['Diamètre', '24 / 28 cm'], ['Induction', 'Compatible']] },
  { key: 'gourde-isotherme', cat: 'kitchen', zh: '316不锈钢保温杯大容量便携水杯', fr: 'Gourde isotherme inox 316 grande capacité', price: 59, weightKg: 0.45, dims: [26, 9, 9], props: 'color', platforms: ['taobao', 'tmall', '1688', 'alibaba'], attrs: [['Contenance', '750 ml'], ['Isolation', '12 h chaud / 24 h froid']] },
  { key: 'couteaux-cuisine', cat: 'kitchen', zh: '德国工艺刀具套装家用厨房菜刀', fr: 'Set de couteaux de cuisine acier (6 pièces)', price: 159, weightKg: 1.6, dims: [38, 22, 8], props: 'none', platforms: ['taobao', 'jd', '1688'], attrs: [['Lame', 'Acier inoxydable 5Cr15'], ['Pièces', '6 + bloc']] },
  // Beauté
  { key: 'pinceaux-maquillage', cat: 'beauty', zh: '化妆刷套装14支软毛眼影刷粉底刷', fr: 'Kit de 14 pinceaux de maquillage poils doux', price: 39, weightKg: 0.25, dims: [22, 10, 5], props: 'color', platforms: ['taobao', '1688', 'alibaba', 'weidian'], attrs: [['Poils', 'Synthétiques'], ['Pochette', 'Incluse']] },
  { key: 'perruque', cat: 'beauty', zh: '真人发丝假发女长卷发全头套', fr: 'Perruque cheveux naturels longs bouclés', price: 299, weightKg: 0.4, dims: [25, 20, 8], props: 'size', platforms: ['taobao', '1688', 'alibaba'], attrs: [['Fibre', 'Cheveux humains Remy'], ['Longueur', '40–60 cm'], ['Origine', 'Xuchang']], keywords: ['wig', 'cheveux'] },
  { key: 'seche-cheveux', cat: 'beauty', zh: '高速吹风机负离子护发家用电吹风', fr: 'Sèche-cheveux haute vitesse ionique', price: 169, weightKg: 0.8, dims: [28, 20, 10], props: 'color', platforms: ['taobao', 'tmall', 'jd', '1688'], attrs: [['Moteur', '110 000 tr/min'], ['Prise', 'Européenne']] },
  // Enfants
  { key: 'blocs-construction', cat: 'kids', zh: '儿童积木拼装玩具益智大颗粒', fr: 'Blocs de construction éducatifs gros modèles', price: 59, weightKg: 1, dims: [35, 25, 10], props: 'size', platforms: ['taobao', '1688', 'alibaba'], attrs: [['Âge', '3 ans +'], ['Pièces', '150 / 300']] },
  { key: 'peluche', cat: 'kids', zh: '可爱毛绒玩具公仔抱枕玩偶', fr: 'Peluche toute douce coussin câlin', price: 39, weightKg: 0.5, dims: [40, 30, 15], props: 'size', platforms: ['taobao', '1688', 'weidian'], attrs: [['Garnissage', 'Coton PP'], ['Tailles', '40 / 60 / 80 cm']] },
  { key: 'poussette', cat: 'kids', zh: '婴儿推车轻便折叠可坐可躺', fr: 'Poussette légère pliable inclinable', price: 499, weightKg: 7.5, dims: [70, 45, 25], props: 'color', platforms: ['taobao', 'tmall', 'jd'], attrs: [['Poids', '6,5 kg'], ['Pliage', 'Une main']] },
  // Sport
  { key: 'tapis-yoga', cat: 'sport', zh: '加厚瑜伽垫防滑健身垫家用', fr: 'Tapis de yoga épais antidérapant', price: 49, weightKg: 1.2, dims: [65, 15, 15], props: 'color', platforms: ['taobao', '1688', 'alibaba'], attrs: [['Épaisseur', '10 mm'], ['Matière', 'NBR']] },
  { key: 'tente-camping', cat: 'sport', zh: '户外帐篷全自动速开防雨露营帐篷', fr: 'Tente de camping montage instantané 3–4 places', price: 259, weightKg: 3.2, dims: [70, 20, 20], props: 'size', platforms: ['taobao', 'tmall', '1688', 'jd'], attrs: [['Places', '3–4'], ['Imperméabilité', '2000 mm']] },
  { key: 'maillot-foot', cat: 'sport', zh: '足球服套装成人儿童训练服可定制', fr: 'Tenue de football personnalisable (maillot + short)', price: 59, weightKg: 0.3, dims: [28, 22, 3], props: 'apparel', platforms: ['taobao', '1688', 'alibaba'], attrs: [['Matière', 'Polyester respirant'], ['Personnalisation', 'Nom + numéro']] },
  // Auto
  { key: 'support-tel-voiture', cat: 'auto', zh: '车载手机支架磁吸出风口导航架', fr: 'Support téléphone voiture magnétique', price: 29, weightKg: 0.15, dims: [12, 8, 6], props: 'color', platforms: ['taobao', '1688', 'alibaba', 'jd'], attrs: [['Fixation', 'Grille de ventilation'], ['Aimant', 'N52']] },
  { key: 'housses-sieges', cat: 'auto', zh: '汽车座套四季通用全包围座椅套', fr: 'Housses de sièges auto universelles', price: 199, weightKg: 3, dims: [50, 40, 15], props: 'color', platforms: ['taobao', '1688'], attrs: [['Matière', 'Cuir PU'], ['Compatibilité', '5 places']] },
  // Outils
  { key: 'perceuse', cat: 'tools', zh: '锂电钻充电式手电钻家用电动螺丝刀', fr: 'Perceuse-visseuse sans fil 21 V', price: 159, weightKg: 2, dims: [35, 28, 10], props: 'none', platforms: ['taobao', 'jd', '1688', 'alibaba'], attrs: [['Tension', '21 V'], ['Batteries', '2 × 2000 mAh'], ['Couple', '45 N·m']], sensitive: true },
  { key: 'tournevis-precision', cat: 'tools', zh: '精密螺丝刀套装手机维修工具', fr: 'Kit tournevis de précision 25 en 1', price: 35, weightKg: 0.3, dims: [18, 10, 4], props: 'none', platforms: ['taobao', '1688', 'alibaba'], attrs: [['Embouts', '24 aimantés'], ['Usage', 'Réparation électronique']] },
  // Bureau
  { key: 'carnet-a5', cat: 'office', zh: 'A5笔记本加厚复古皮面记事本', fr: 'Carnet A5 couverture simili-cuir épais', price: 19, weightKg: 0.35, dims: [22, 16, 3], props: 'color', platforms: ['taobao', '1688', 'alibaba'], attrs: [['Pages', '200'], ['Papier', '100 g/m²']] },
  { key: 'stylos-gel', cat: 'office', zh: '中性笔0.5mm黑色签字笔学生用', fr: 'Stylos gel 0,5 mm (lot de 12)', price: 12, weightKg: 0.15, dims: [16, 8, 3], props: 'color', platforms: ['taobao', '1688'], attrs: [['Pointe', '0,5 mm'], ['Lot', '12']] },
  // Gros
  { key: 'cartons-expedition', cat: 'wholesale', zh: '快递纸箱打包搬家纸箱定做', fr: "Cartons d'expédition personnalisables", price: 2, weightKg: 0.2, dims: [30, 20, 2], props: 'size', platforms: ['1688', 'alibaba', 'taobao'], attrs: [['Cannelure', 'Simple / double'], ['Impression', 'Logo possible']] },
  { key: 'sachets-zip', cat: 'wholesale', zh: '自封袋加厚透明密封袋定制印刷', fr: 'Sachets zip transparents épais imprimables', price: 0.3, weightKg: 0.005, dims: [20, 15, 1], props: 'size', platforms: ['1688', 'alibaba'], attrs: [['Épaisseur', '8 fils'], ['Impression', 'Possible dès 1000 pcs']] },
];

export const SHOP_NAMES: Record<string, string[]> = {
  women: ['衣品优选女装店', '小鹿家原创女装', '杭州四季青服饰'],
  men: ['型男潮牌工作室', '简约男装旗舰', '广州十三行男装'],
  shoes: ['莆田鞋业源头厂', '晋江运动鞋城', '步履不停鞋店'],
  bags: ['白沟箱包批发', '旅行家箱包', '小众包包设计馆'],
  jewelry: ['义乌饰品源头', '银匠手作', '深圳钟表配件'],
  electronics: ['华强北数码', '深圳声学科技', '极客数码优选'],
  phone: ['手机配件批发城', '深圳快充工厂', '潮壳设计'],
  home: ['家居生活馆', '义乌家居百货', '北欧小屋'],
  kitchen: ['厨房好物铺', '永康厨具厂', '品质生活馆'],
  beauty: ['美妆工具批发', '许昌发制品', '颜值研究所'],
  kids: ['澄海玩具厂', '萌宝母婴店', '童趣乐园'],
  sport: ['户外运动装备', '健身达人馆', '球衣定制工作室'],
  auto: ['车品优选', '汽车用品源头厂', '驾趣车饰'],
  tools: ['永康五金工具', '工具达人', '五金批发城'],
  office: ['文具批发中心', '纸品工坊', '学霸文具'],
  wholesale: ['包装材料厂', '东莞包装印刷', '义乌包装批发'],
};

export const LOCATIONS: Record<string, string[]> = {
  women: ['浙江 杭州', '广东 广州'],
  men: ['广东 广州', '福建 泉州'],
  shoes: ['福建 莆田', '福建 泉州'],
  bags: ['河北 保定', '广东 广州'],
  jewelry: ['浙江 义乌', '广东 深圳'],
  electronics: ['广东 深圳', '广东 东莞'],
  phone: ['广东 深圳', '浙江 义乌'],
  home: ['浙江 义乌', '广东 佛山'],
  kitchen: ['浙江 永康', '广东 潮州'],
  beauty: ['河南 许昌', '浙江 义乌'],
  kids: ['广东 汕头', '浙江 义乌'],
  sport: ['福建 晋江', '浙江 义乌'],
  auto: ['广东 广州', '浙江 台州'],
  tools: ['浙江 永康', '江苏 苏州'],
  office: ['浙江 宁波', '浙江 义乌'],
  wholesale: ['广东 东莞', '浙江 义乌'],
};
