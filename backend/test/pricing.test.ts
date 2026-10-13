import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SHIPPING_LINES } from '../src/config.js';
import { applicableTier, findSku, serviceFee, unitPrice } from '../src/lib/pricing.js';
import { estimateParcel, quoteAll, quoteLine, volumetricWeight } from '../src/lib/shipping.js';
import { mapItem, mapSearchItem, normalizeImageUrl } from '../src/providers/onebound.js';

const dhl = SHIPPING_LINES.find((l) => l.id === 'dhl')!;

describe('expédition', () => {
  it('calcule le poids volumétrique L×l×h / diviseur', () => {
    assert.equal(volumetricWeight({ lengthCm: 50, widthCm: 40, heightCm: 30 }, 5000), 12);
  });

  it('facture le plus grand du poids réel et du poids volumétrique', () => {
    const q = quoteLine(dhl, { country: 'FR', weightKg: 2, dimensions: { lengthCm: 50, widthCm: 40, heightCm: 30 } });
    assert.equal(q.chargeableWeightKg, 12);
    // 0,5 kg puis 23 tranches de 0,5 kg : 210 + 23 × 55 = 1475 ; carburant 15 % ; frais 8
    assert.equal(q.freight, 1475);
    assert.equal(q.fuelSurcharge, 221.25);
    assert.equal(q.total, 1475 + 221.25 + 8);
  });

  it('arrondit à la tranche supérieure entamée', () => {
    const q = quoteLine(dhl, { country: 'FR', weightKg: 0.51 });
    assert.equal(q.freight, 210 + 55);
    const exact = quoteLine(dhl, { country: 'FR', weightKg: 1 });
    assert.equal(exact.freight, 210 + 55);
  });

  it('applique le multiplicateur de zone et les restrictions', () => {
    const fr = quoteLine(dhl, { country: 'FR', weightKg: 1 });
    const mg = quoteLine(dhl, { country: 'MG', weightKg: 1 });
    assert.equal(mg.freight, Math.round(fr.freight * 1.35 * 100) / 100);
    assert.equal(quoteLine(dhl, { country: 'FR', weightKg: 1, sensitive: true }).available, false);
    assert.equal(quoteLine(dhl, { country: 'ZZ', weightKg: 1 }).available, false);
  });

  it('trie les devis : disponibles d’abord puis par prix', () => {
    const quotes = quoteAll({ country: 'FR', weightKg: 1.2, sensitive: true });
    const available = quotes.filter((q) => q.available);
    assert.ok(available.length >= 1);
    assert.ok(available.every((q, i) => i === 0 || available[i - 1]!.total <= q.total));
    assert.ok(quotes.findIndex((q) => !q.available) >= available.length);
  });

  it('estime le colis avec les services choisis', () => {
    const base = estimateParcel([{ weightKg: 1, volumeCm3: 6000, quantity: 1 }], []);
    assert.equal(base.weightKg, 1.1);
    const lighter = estimateParcel([{ weightKg: 1, volumeCm3: 6000, quantity: 1 }], [{ id: 'remove_packaging', scope: 'parcel', name: '', price: 0, description: '', weightFactor: 0.85 }]);
    assert.ok(lighter.weightKg < base.weightKg);
  });
});

describe('prix et frais', () => {
  const product = {
    price: 10,
    priceTiers: [
      { minQty: 2, price: 10 },
      { minQty: 20, price: 9 },
      { minQty: 100, price: 8 },
    ],
    props: [{ pid: '1', name: 'Couleur', values: [{ vid: 'a', name: 'Noir' }] }],
    skus: [{ skuId: 's1', props: { '1': 'a' }, price: 12, stock: 5 }],
  };

  it('applique les paliers de prix de gros', () => {
    assert.equal(applicableTier(product.priceTiers, 1), undefined);
    assert.equal(applicableTier(product.priceTiers, 25)?.price, 9);
    assert.equal(unitPrice(product, undefined, 150), 8);
    // Écart propre au SKU conservé : 12 - 10 + 9
    assert.equal(unitPrice(product, product.skus[0], 20), 11);
  });

  it('retrouve le SKU sélectionné', () => {
    assert.equal(findSku(product, { '1': 'a' })?.skuId, 's1');
    assert.equal(findSku(product, { '1': 'b' }), undefined);
  });

  it('calcule les frais de service', () => {
    assert.equal(serviceFee('taobao', 200), 10);
  });
});

describe('adaptateur Onebound (parsing défensif)', () => {
  it('normalise les URL d’images', () => {
    assert.equal(normalizeImageUrl('//img.alicdn.com/a.jpg'), 'https://img.alicdn.com/a.jpg');
    assert.equal(normalizeImageUrl(undefined), '');
  });

  it('convertit un article et ses SKU', () => {
    const p = mapItem('taobao', '123456', {
      num_iid: '123456',
      title: '纯棉T恤',
      price: '49.00',
      pic_url: '//img.alicdn.com/main.jpg',
      item_imgs: [{ url: '//img.alicdn.com/1.jpg' }],
      props_list: { '1627207:28341': '颜色:黑色', '20509:28315': '尺码:M' },
      skus: { sku: [{ sku_id: '9', price: '52.5', quantity: '7', properties: '1627207:28341;20509:28315' }] },
      props: [{ name: '面料', value: '棉' }],
      nick: '某店',
      post_fee: '6',
    });
    assert.equal(p.price, 52.5);
    assert.equal(p.image, 'https://img.alicdn.com/main.jpg');
    assert.equal(p.props.length, 2);
    assert.deepEqual(p.skus[0]?.props, { '1627207': '28341', '20509': '28315' });
    assert.equal(p.domesticShipping, 6);
    assert.equal(p.isDemoData, false);
  });

  it('ignore les résultats de recherche sans identifiant', () => {
    assert.equal(mapSearchItem('1688', { title: 'x' }), null);
    assert.equal(mapSearchItem('1688', { num_iid: 77777, title: 'x', price: '3.5' })?.price, 3.5);
  });
});
