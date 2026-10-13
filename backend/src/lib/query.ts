/**
 * Préparation des mots-clés pour les vraies plateformes chinoises, qui cherchent en chinois.
 * Comme Superbuy/CSSBuy, on traduit les termes courants (« coque iphone » → « 手机壳 iphone ») ;
 * les mots inconnus (marques, modèles, chiffres) sont conservés tels quels.
 * Un texte qui contient déjà des caractères chinois est envoyé sans modification.
 */
import { CATEGORIES } from '../data/categories.js';

/** Glossaire français → chinois des recherches d'achat les plus fréquentes (expressions d'abord). */
const GLOSSARY: [string, string][] = [
  // Mode
  ['robe de soiree', '晚礼服'],
  ['robe de mariee', '婚纱'],
  ['robe', '连衣裙'],
  ['jupe', '半身裙'],
  ['t shirt', 'T恤'],
  ['tee shirt', 'T恤'],
  ['tshirt', 'T恤'],
  ['chemise', '衬衫'],
  ['chemisier', '女士衬衫'],
  ['pull', '毛衣'],
  ['sweat', '卫衣'],
  ['hoodie', '连帽卫衣'],
  ['veste', '夹克'],
  ['manteau', '大衣'],
  ['doudoune', '羽绒服'],
  ['jean', '牛仔裤'],
  ['jeans', '牛仔裤'],
  ['pantalon', '裤子'],
  ['short', '短裤'],
  ['costume', '西装'],
  ['pyjama', '睡衣'],
  ['maillot de bain', '泳衣'],
  ['lingerie', '内衣'],
  ['chaussettes', '袜子'],
  ['casquette', '棒球帽'],
  ['chapeau', '帽子'],
  ['echarpe', '围巾'],
  ['ceinture', '腰带'],
  ['lunettes de soleil', '太阳镜'],
  ['lunettes', '眼镜'],
  // Chaussures et sacs
  ['chaussures de sport', '运动鞋'],
  ['baskets', '运动鞋'],
  ['basket', '运动鞋'],
  ['sneakers', '运动鞋'],
  ['chaussures', '鞋'],
  ['chaussure', '鞋'],
  ['bottes', '靴子'],
  ['sandales', '凉鞋'],
  ['talons', '高跟鞋'],
  ['sac a dos', '双肩包'],
  ['sac a main', '手提包'],
  ['sac', '包'],
  ['valise', '行李箱'],
  ['portefeuille', '钱包'],
  // Bijoux et montres
  ['montre connectee', '智能手表'],
  ['montre', '手表'],
  ['collier', '项链'],
  ['bracelet', '手链'],
  ['bague', '戒指'],
  ['boucles d oreilles', '耳环'],
  // Électronique et téléphone
  ['coque', '手机壳'],
  ['etui', '保护套'],
  ['chargeur', '充电器'],
  ['cable', '数据线'],
  ['batterie externe', '充电宝'],
  ['powerbank', '充电宝'],
  ['ecouteurs', '耳机'],
  ['ecouteur', '耳机'],
  ['casque moto', '摩托车头盔'],
  ['casque velo', '自行车头盔'],
  ['casque de moto', '摩托车头盔'],
  ['casque de velo', '自行车头盔'],
  ['casque audio', '头戴式耳机'],
  ['casque', '头戴式耳机'],
  ['enceinte', '音箱'],
  ['clavier', '键盘'],
  ['souris', '鼠标'],
  ['telephone', '手机'],
  ['tablette', '平板电脑'],
  ['ordinateur portable', '笔记本电脑'],
  ['camera', '摄像头'],
  ['lampe', '台灯'],
  ['led', 'LED灯'],
  ['ventilateur', '风扇'],
  // Maison, cuisine
  ['rideau', '窗帘'],
  ['coussin', '抱枕'],
  ['draps', '床单'],
  ['couette', '被子'],
  ['tapis', '地毯'],
  ['rangement', '收纳'],
  ['poele', '平底锅'],
  ['casserole', '锅'],
  ['couteau', '刀'],
  ['tasse', '杯子'],
  ['gourde', '水杯'],
  ['assiette', '盘子'],
  // Beauté
  ['maquillage', '化妆品'],
  ['rouge a levres', '口红'],
  ['pinceaux', '化妆刷'],
  ['perruque', '假发'],
  ['faux ongles', '美甲贴片'],
  ['parfum', '香水'],
  // Enfants, sport, divers
  ['jouet', '玩具'],
  ['jouets', '玩具'],
  ['peluche', '毛绒玩具'],
  ['poussette', '婴儿车'],
  ['bebe', '婴儿'],
  ['velo', '自行车'],
  ['tapis de yoga', '瑜伽垫'],
  ['tente', '帐篷'],
  ['football', '足球'],
  ['outil', '工具'],
  ['perceuse', '电钻'],
  ['stylo', '笔'],
  ['cahier', '笔记本'],
  ['autocollant', '贴纸'],
  ['emballage', '包装'],
  // Qualificatifs fréquents
  ['femme', '女'],
  ['homme', '男'],
  ['enfant', '儿童'],
  ['noir', '黑色'],
  ['blanc', '白色'],
  ['rouge', '红色'],
  ['bleu', '蓝色'],
  ['vert', '绿色'],
  ['rose', '粉色'],
  ['gris', '灰色'],
  ['cuir', '真皮'],
  ['coton', '纯棉'],
  ['soie', '真丝'],
  ['sans fil', '无线'],
  ['ete', '夏季'],
  ['hiver', '冬季'],
];

/** Mots vides retirés de la requête (« une robe pour femme » → « robe femme »). */
const STOP_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'pour', 'en', 'et', 'a', 'au', 'aux', 'avec']);

const CJK = /[㐀-鿿]/;

/** Lettres accentuées du français (table explicite : pas de dépendance à String.prototype.normalize). */
const ACCENTS: Record<string, string> = { à: 'a', â: 'a', ä: 'a', á: 'a', ç: 'c', é: 'e', è: 'e', ê: 'e', ë: 'e', î: 'i', ï: 'i', í: 'i', ô: 'o', ö: 'o', ó: 'o', ù: 'u', û: 'u', ü: 'u', ú: 'u', ÿ: 'y', ñ: 'n', œ: 'oe', æ: 'ae' };

/** Minuscules, sans accents ni ponctuation (« Sac à dos ! » → « sac a dos »). */
export function foldText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[àâäáçéèêëîïíôöóùûüúÿñœæ]/g, (c) => ACCENTS[c] ?? c)
    // Le point et la virgule entre deux chiffres sont gardés (« 3.5mm », « 2,4 GHz »).
    .replace(/(\d)[.,](?=\d)/g, '$1\u0000')
    .replace(/['’\-_/.,;:!?()]+/g, ' ')
    .replace(/\u0000/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

const ENTRIES = GLOSSARY.map(([fr, zh]) => ({ words: foldText(fr).split(' '), zh })).sort((a, b) => b.words.length - a.words.length);

/** Traduit les termes connus ; renvoie la requête d'origine si elle contient déjà du chinois. */
export function translateQuery(text: string): string {
  const raw = text.trim();
  if (!raw || CJK.test(raw)) return raw;
  const words = foldText(raw).split(' ').filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    const match = ENTRIES.find((e) => e.words.every((w, k) => words[i + k] === w));
    if (match) {
      if (!out.includes(match.zh)) out.push(match.zh);
      i += match.words.length;
      continue;
    }
    const word = words[i]!;
    // « a » devant un chiffre fait partie d'un modèle (« Galaxy A 54 ») : on le garde.
    const partOfModel = /^\d/.test(words[i + 1] ?? '');
    if (!STOP_WORDS.has(word) || partOfModel) out.push(word);
    i += 1;
  }
  return out.join(' ');
}

/** Mot-clé chinois représentatif d'une catégorie de l'application (« women » → « 女装 »). */
export function categoryKeyword(categoryId?: string): string | undefined {
  if (!categoryId) return undefined;
  return CATEGORIES.find((c) => c.id === categoryId)?.keywords.find((k) => CJK.test(k));
}

/**
 * Requête envoyée à un vrai fournisseur : mots-clés traduits + mot-clé de la catégorie.
 * Sans mot-clé ni catégorie, on cherche les meilleures ventes (« 热销 »).
 */
export function providerQuery(q: string, categoryId?: string): string {
  const translated = translateQuery(q);
  const cat = categoryKeyword(categoryId);
  const parts = [translated, cat && !translated.includes(cat) ? cat : ''].filter(Boolean);
  return parts.join(' ') || '热销';
}
