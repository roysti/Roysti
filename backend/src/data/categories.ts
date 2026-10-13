import type { Category } from '../types.js';

export const CATEGORIES: Category[] = [
  { id: 'women', name: 'Mode femme', icon: '👗', keywords: ['robe', 'femme', 'jupe', 'chemisier', 'dress', '女装', '连衣裙'] },
  { id: 'men', name: 'Mode homme', icon: '👔', keywords: ['homme', 'chemise', 'veste', 'pantalon', 'men', '男装', '衬衫'] },
  { id: 'shoes', name: 'Chaussures', icon: '👟', keywords: ['chaussure', 'basket', 'sneaker', 'botte', 'sandale', '鞋', '运动鞋'] },
  { id: 'bags', name: 'Sacs & bagages', icon: '👜', keywords: ['sac', 'valise', 'bagage', 'sac à dos', 'bag', '包', '背包', '行李箱'] },
  { id: 'jewelry', name: 'Montres & bijoux', icon: '⌚', keywords: ['montre', 'bijou', 'collier', 'bague', 'bracelet', 'watch', '手表', '项链'] },
  { id: 'electronics', name: 'Électronique', icon: '🎧', keywords: ['écouteur', 'casque', 'enceinte', 'montre connectée', 'électronique', '耳机', '数码'] },
  { id: 'phone', name: 'Accessoires téléphone', icon: '📱', keywords: ['coque', 'chargeur', 'câble', 'batterie', 'powerbank', 'téléphone', '手机壳', '充电器'] },
  { id: 'home', name: 'Maison & déco', icon: '🛋️', keywords: ['maison', 'déco', 'lampe', 'rideau', 'coussin', 'rangement', '家居', '台灯'] },
  { id: 'kitchen', name: 'Cuisine', icon: '🍳', keywords: ['cuisine', 'poêle', 'couteau', 'tasse', 'gourde', 'kitchen', '厨房', '水杯'] },
  { id: 'beauty', name: 'Beauté & soins', icon: '💄', keywords: ['beauté', 'maquillage', 'pinceau', 'perruque', 'cheveux', 'ongles', '美妆', '假发'] },
  { id: 'kids', name: 'Jouets & bébé', icon: '🧸', keywords: ['jouet', 'bébé', 'enfant', 'peluche', 'lego', 'toy', '玩具', '婴儿'] },
  { id: 'sport', name: 'Sport & plein air', icon: '⚽', keywords: ['sport', 'yoga', 'fitness', 'camping', 'vélo', 'football', '运动', '户外'] },
  { id: 'auto', name: 'Auto & moto', icon: '🚗', keywords: ['voiture', 'auto', 'moto', 'housse', 'support', 'car', '汽车', '车载'] },
  { id: 'tools', name: 'Outils & bricolage', icon: '🔧', keywords: ['outil', 'perceuse', 'tournevis', 'bricolage', 'tool', '工具', '电钻'] },
  { id: 'office', name: 'Bureau & papeterie', icon: '✏️', keywords: ['bureau', 'stylo', 'cahier', 'papeterie', 'office', '文具', '笔记本'] },
  { id: 'wholesale', name: 'Emballage & gros', icon: '📦', keywords: ['emballage', 'carton', 'sachet', 'étiquette', 'gros', 'wholesale', '包装', '批发'] },
];
