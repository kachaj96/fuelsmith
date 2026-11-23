import { describe, expect, it } from 'vitest';
import { buildQuery, DEFAULT_FILTERS, fold, matchScore, RateLimit, searchOff, searchUrl, sortHits, stem, words, activeCount, sameQuery } from '../../src/domain/search';
import type { Fetcher, OffProduct } from '../../src/domain/off';

const P = (name: string, kcal: number, p: number, f = 0, c = 0): OffProduct => ({ ean: '', name, per100: { kcal, p, f, c }, missing: [] });

describe('query', () => {
  it('drops query syntax and short Polish words, keeps "bez"', () => {
    expect(words('pierś z kurczaka')).toEqual(['pierś', 'kurczaka']);
    expect(words('mleko bez laktozy')).toEqual(['mleko', 'bez', 'laktozy']);
    expect(words('skyr" OR (x:*)')).toEqual(['skyr', 'OR', 'x']);
    expect(words('z')).toEqual(['z']);   // nothing else left: keep it
  });
  it('adds the base form next to an inflected word', () => {
    expect([stem('jogurty'), stem('kurczaka'), stem('twarogu'), stem('skyr'), stem('mleko'), stem('500ml')]).toEqual(['jogurt', 'kurczak', 'twarog', null, null, null]);
  });
  it('default filters: Poland and full macros', () => {
    expect(buildQuery('skyr', DEFAULT_FILTERS)).toBe('skyr countries_tags:"en:poland" nutriments.proteins_100g:* nutriments.fat_100g:* nutriments.carbohydrates_100g:*');
  });
  it('categories are OR, labels are all required', () => {
    const q = buildQuery('jogurty', { ...DEFAULT_FILTERS, poland: false, full: false, cats: ['dairy', 'meat'], labels: ['vegan', 'gluten'] });
    expect(q).toBe('jogurty jogurt (categories_tags:"en:dairies" OR categories_tags:"en:meats" OR categories_tags:"en:seafood") labels_tags:"en:vegan" labels_tags:"en:no-gluten"');
  });
  it('the url sends the query, the page and 20 per page, nothing else', () => {
    const u = new URL(searchUrl('skyr', { ...DEFAULT_FILTERS, poland: false, full: false }, 2));
    expect(u.origin + u.pathname).toBe('https://search.openfoodfacts.org/search');
    expect([...u.searchParams.keys()].sort()).toEqual(['fields', 'page', 'page_size', 'q']);
    expect([u.searchParams.get('q'), u.searchParams.get('page'), u.searchParams.get('page_size')]).toEqual(['skyr', '2', '20']);
  });
  it('counts and compares filters', () => {
    expect(activeCount(DEFAULT_FILTERS)).toBe(2);
    expect(sameQuery(DEFAULT_FILTERS, { ...DEFAULT_FILTERS, sort: 'kcal' })).toBe(true);   // sorting alone needs no new request
    expect(sameQuery(DEFAULT_FILTERS, { ...DEFAULT_FILTERS, cats: ['dairy'] })).toBe(false);
  });
});

describe('ranking and sorting on the phone', () => {
  it('matches without Polish marks and by the first 5 letters', () => {
    expect(fold('Twaróg Łaciaty')).toBe('twarog laciaty');
    expect(matchScore({ name: 'Twaróg półtłusty' }, 'twarogu półtłustego')).toBe(2);
    expect(matchScore({ name: 'Ser żółty' }, 'jogurty')).toBe(0);
  });
  it('best match first, server order kept otherwise', () => {
    expect(sortHits([P('Kiełki', 50, 4), P('Jogurt naturalny', 60, 4), P('Jogurt grecki', 120, 9)], 'jogurty naturalne', 'match').map(h => h.name)).toEqual(['Jogurt naturalny', 'Jogurt grecki', 'Kiełki']);
  });
  it('protein per 100 kcal, values that do not add up go last', () => {
    // 12/63 = 0.190, 7.5/64 = 0.117, 76/98 does not add up (76 g protein would be 304 kcal)
    const xs = [P('B', 64, 7.5, 0.3, 7.9), P('bad', 98, 76, 0, 3), P('A', 63, 12, 0, 3.8)];
    expect(sortHits(xs, 'skyr', 'protein').map(h => h.name)).toEqual(['A', 'B', 'bad']);
    expect(sortHits(xs, 'skyr', 'kcal').map(h => h.name)).toEqual(['A', 'B', 'bad']);
  });
});

describe('search request', () => {
  const answer = (status: number, body: unknown): Fetcher => async () => ({ ok: status < 400, status, json: async () => body });
  it('maps hits, drops ones without a name or values', async () => {
    const r = await searchOff('skyr', DEFAULT_FILTERS, 1, answer(200, { count: 25, page_count: 2, hits: [
      { code: '5900000000015', product_name: 'Skyr naturalny', brands: ['Marka'], quantity: '150 g', nutriments: { 'energy-kcal_100g': 63, proteins_100g: 12, fat_100g: 0, carbohydrates_100g: 3.8 } },
      { code: '1', brands: ['Bez nazwy'], nutriments: { 'energy-kcal_100g': 60 } },
      { code: '2', product_name: 'Bez wartości', nutriments: {} }] }));
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect([r.count, r.pages, r.hits.length]).toEqual([25, 2, 1]);
    expect(r.hits[0]).toMatchObject({ ean: '5900000000015', name: 'Skyr naturalny', brand: 'Marka', pack: 150, per100: { kcal: 63, p: 12, f: 0, c: 3.8 } });
  });
  it('server trouble and no network are "offline", a bad request is an error', async () => {
    expect((await searchOff('a b', DEFAULT_FILTERS, 1, answer(503, {}))).kind).toBe('offline');
    expect((await searchOff('a b', DEFAULT_FILTERS, 1, answer(429, {}))).kind).toBe('offline');
    expect((await searchOff('a b', DEFAULT_FILTERS, 1, async () => { throw new TypeError('Failed to fetch'); })).kind).toBe('offline');
    expect(await searchOff('a b', DEFAULT_FILTERS, 1, answer(422, {}))).toEqual({ kind: 'error', detail: 'HTTP 422' });
  });
});

describe('10 searches a minute', () => {
  it('the 11th waits until the first one is a minute old', () => {
    const l = new RateLimit(); const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) expect(l.take(t0 + i * 1000)).toBe(true);
    expect(l.take(t0 + 15_000)).toBe(false);
    expect(l.wait(t0 + 15_000)).toBe(45);   // the first one leaves the window at t0 + 60 s
    expect(l.take(t0 + 60_000)).toBe(true);
  });
});
