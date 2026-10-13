import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractFirstUrl, isShortLink, parseProductLink, resolveProductLink } from '../src/lib/linkParser.js';

describe('parseProductLink', () => {
  const cases: [string, string, string][] = [
    ['https://item.taobao.com/item.htm?spm=a1z10&id=675330231400', 'taobao', '675330231400'],
    ['https://m.intl.taobao.com/detail/detail.html?id=675330231400', 'taobao', '675330231400'],
    ['https://world.taobao.com/item/675330231400.htm', 'taobao', '675330231400'],
    ['https://detail.tmall.com/item.htm?id=612345678901&skuId=1', 'tmall', '612345678901'],
    ['https://detail.1688.com/offer/712345678901.html?spm=a26352', '1688', '712345678901'],
    ['https://m.1688.com/offer/712345678901.html', '1688', '712345678901'],
    ['https://detail.m.1688.com/page/index.html?offerId=712345678901', '1688', '712345678901'],
    ['https://www.alibaba.com/product-detail/Wholesale-Cotton-T-Shirt_1600123456789.html', 'alibaba', '1600123456789'],
    ['https://item.jd.com/100012043978.html', 'jd', '100012043978'],
    ['https://item.m.jd.com/product/100012043978.html', 'jd', '100012043978'],
    ['https://weidian.com/item.html?itemID=7234567890', 'weidian', '7234567890'],
    ['https://www.cssbuy.com/item-675330231400.html', 'taobao', '675330231400'],
    ['https://www.cssbuy.com/item-1688-712345678901.html', '1688', '712345678901'],
    ['https://www.cssbuy.com/item-micro-7234567890.html', 'weidian', '7234567890'],
    [
      'https://www.superbuy.com/en/page/buy?nTag=Home-search&url=' + encodeURIComponent('https://item.taobao.com/item.htm?id=675330231400'),
      'taobao',
      '675330231400',
    ],
    ['item.taobao.com/item.htm?id=675330231400', 'taobao', '675330231400'],
  ];

  for (const [input, platform, itemId] of cases) {
    it(`reconnaît ${input.slice(0, 70)}`, () => {
      assert.deepEqual(parseProductLink(input), { platform, itemId });
    });
  }

  it('extrait le lien d’un texte de partage', () => {
    const text = '【淘宝】https://item.taobao.com/item.htm?id=675330231400 「重磅纯棉T恤」点击链接直接打开';
    assert.deepEqual(parseProductLink(text), { platform: 'taobao', itemId: '675330231400' });
  });

  it('refuse les liens inconnus ou sans identifiant', () => {
    assert.equal(parseProductLink('https://example.com/item?id=123456'), null);
    assert.equal(parseProductLink('https://item.taobao.com/item.htm'), null);
    assert.equal(parseProductLink('bonjour'), null);
  });

  it('détecte les liens courts', () => {
    assert.equal(isShortLink('https://m.tb.cn/h.5abcd?tk=xyz'), true);
    assert.equal(isShortLink('https://item.taobao.com/item.htm?id=1'), false);
    assert.equal(extractFirstUrl('voir https://m.tb.cn/h.5abcd ici'), 'https://m.tb.cn/h.5abcd');
  });

  it('résout un lien court via la redirection ou le corps HTML', async () => {
    const viaRedirect = (async () =>
      ({ url: 'https://item.taobao.com/item.htm?id=675330231400', text: async () => '' }) as Response) as typeof fetch;
    assert.deepEqual(await resolveProductLink('https://m.tb.cn/h.abc', viaRedirect), { platform: 'taobao', itemId: '675330231400' });

    const viaBody = (async () =>
      ({
        url: 'https://m.tb.cn/h.abc',
        text: async () => "<script>var url = 'https://a.m.taobao.com/i675330231400.htm?id=675330231400&amp;x=1';</script>",
      }) as Response) as typeof fetch;
    assert.deepEqual(await resolveProductLink('https://m.tb.cn/h.abc', viaBody), { platform: 'taobao', itemId: '675330231400' });
  });
});
