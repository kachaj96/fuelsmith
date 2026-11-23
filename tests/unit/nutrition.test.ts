import { describe, expect, it } from 'vitest';
import { avg7, avgKcal, dayTotals, forGrams, kcalFromMacros, looksWrong, recipePer100, targets, validEan, weeklyChange, type Entry } from '../../src/domain/nutrition';
import { gramsOf, lookupEan, mapOff, type Fetcher } from '../../src/domain/off';

/* Reference values worked out by hand (see the comments), not taken from the code under test. */
describe('portion maths', () => {
  it('77 g of a product with 441 kcal, 5.7 / 14 / 73.8 g per 100 g', () => {
    // 441 * 0.77 = 339.57; 5.7 * 0.77 = 4.389; 14 * 0.77 = 10.78; 73.8 * 0.77 = 56.826
    expect(forGrams({ kcal: 441, p: 5.7, f: 14, c: 73.8 }, 77)).toEqual({ kcal: 340, p: 4.4, f: 10.8, c: 56.8 });
  });
  it('zero and negative grams give zero', () => {
    expect(forGrams({ kcal: 441, p: 5.7, f: 14, c: 73.8 }, -5)).toEqual({ kcal: 0, p: 0, f: 0, c: 0 });
  });
  it('a day adds its entries', () => {
    const e = (g: number): Entry => ({ id: String(g), date: '2026-11-23', meal: 'lunch', productId: 'x', name: 'x', grams: g, per100: { kcal: 100, p: 10, f: 5, c: 1 }, at: 0 });
    expect(dayTotals([e(150), e(50)])).toEqual({ kcal: 200, p: 20, f: 10, c: 2, fiber: 0 });
  });
});

describe('label check', () => {
  it('energy from macros uses 4 / 9 / 4 and 2 for fibre', () => {
    // 5.7*4 + 14*9 + 73.8*4 + 4.8*2 = 22.8 + 126 + 295.2 + 9.6 = 453.6
    expect(kcalFromMacros({ kcal: 441, p: 5.7, f: 14, c: 73.8, fiber: 4.8 })).toBe(454);
  });
  it('a correct label passes, a typo is caught', () => {
    expect(looksWrong({ kcal: 133, p: 18, f: 4, c: 3.5 })).toBe(false);   // 122 from macros: 8 % apart
    expect(looksWrong({ kcal: 133, p: 18, f: 40, c: 3.5 })).toBe(true);   // 446 from macros
    expect(looksWrong({ kcal: 300, p: 60, f: 30, c: 20 })).toBe(true);    // 110 g of nutrients in 100 g
  });
});

describe('targets (Mifflin-St Jeor)', () => {
  it('man, 36, 180 cm, 80 kg, moderate activity, cut, 1.8 g/kg protein', () => {
    // BMR = 10*80 + 6.25*180 - 5*36 + 5 = 1750; * 1.55 = 2712.5; * 0.8 = 2170
    // protein 144 g; fat max(64, 2170*0.25/9 = 60.3) = 64 g; carbs (2170 - 576 - 576) / 4 = 254.5 -> 255
    expect(targets({ sex: 'm', birthYear: 1990, heightCm: 180, weightKg: 80, activity: 3, goal: 'cut', proteinPerKg: 1.8 }, 2026)).toEqual({ kcal: 2170, p: 144, f: 64, c: 255 });
  });
  it('woman, 31, 165 cm, 60 kg, light activity, keep, 1.6 g/kg', () => {
    // BMR = 600 + 1031.25 - 155 - 161 = 1315.25; * 1.375 = 1808.5 -> 1810; protein 96; fat max(48, 50.3) = 50; carbs (1810 - 384 - 450) / 4 = 244
    expect(targets({ sex: 'f', birthYear: 1995, heightCm: 165, weightKg: 60, activity: 2, goal: 'keep', proteinPerKg: 1.6 }, 2026)).toEqual({ kcal: 1810, p: 96, f: 50, c: 244 });
  });
  it('an override wins and the rest is recomputed from it', () => {
    // kcal 2000 set by hand: protein 144, fat max(64, 55.6) = 64, carbs (2000 - 576 - 576) / 4 = 212
    expect(targets({ sex: 'm', birthYear: 1990, heightCm: 180, weightKg: 80, activity: 3, goal: 'cut', proteinPerKg: 1.8 }, 2026, { kcal: 2000 })).toEqual({ kcal: 2000, p: 144, f: 64, c: 212 });
  });
});

describe('recipes', () => {
  it('porridge: 60 g oats + 250 g milk, 300 g after cooking', () => {
    // oats 60 g: 227 kcal, 7.9 / 3.9 / 40.6; milk 250 g: 160 kcal, 8.3 / 8 / 12; total 387, 16.2 / 11.9 / 52.6
    // per 100 g of 300: 129 kcal, 5.4 / 4.0 / 17.5
    const r = { items: [{ productId: 'o', name: 'oats', grams: 60, per100: { kcal: 379, p: 13.2, f: 6.5, c: 67.7 } }, { productId: 'm', name: 'milk', grams: 250, per100: { kcal: 64, p: 3.3, f: 3.2, c: 4.8 } }], cooked: 300 };
    expect(recipePer100(r)).toEqual({ kcal: 129, p: 5.4, f: 4, c: 17.5 });
  });
  it('without a cooked weight the raw sum is used', () => {
    expect(recipePer100({ items: [{ productId: 'a', name: 'a', grams: 200, per100: { kcal: 100, p: 10, f: 10, c: 10 } }] })).toEqual({ kcal: 100, p: 10, f: 10, c: 10 });
  });
});

describe('body weight trend', () => {
  const ws = [['2026-11-10', 81.0], ['2026-11-12', 80.8], ['2026-11-15', 80.6], ['2026-11-17', 80.4], ['2026-11-19', 80.2], ['2026-11-21', 80.0], ['2026-11-23', 79.6]].map(([date, kg]) => ({ date: date as string, kg: kg as number }));
  it('7-day average ending on a day', () => {
    // 17..23: 80.4, 80.2, 80.0, 79.6 -> 320.2 / 4 = 80.05 -> 80.1 (rounded half up)
    expect(avg7(ws, '2026-11-23')).toBe(80.1);
    // 10..16: 81.0, 80.8, 80.6 -> 80.8
    expect(avg7(ws, '2026-11-16')).toBe(80.8);
  });
  it('weekly change of the average', () => { expect(weeklyChange(ws, '2026-11-23')).toBe(-0.7); });
  it('average energy counts only days with entries', () => {
    const e = (d: string, k: number): Entry => ({ id: d + k, date: d, meal: 'lunch', productId: 'x', name: 'x', grams: 100, per100: { kcal: k, p: 0, f: 0, c: 0 }, at: 0 });
    expect(avgKcal([e('2026-11-23', 2000), e('2026-11-23', 200), e('2026-11-21', 1800), e('2026-11-10', 9999)], '2026-11-23')).toEqual({ avg: 2000, days: 2 });
  });
});

describe('barcodes', () => {
  it('valid check digits', () => {
    for (const c of ['5900259128546', '4006381333931', '96385074', '036000291452']) expect(validEan(c), c).toBe(true);
  });
  it('wrong check digit, wrong length, letters', () => {
    for (const c of ['5900259128547', '59002591285', 'ABC00259128546', '']) expect(validEan(c), c).toBe(false);
  });
});

describe('Open Food Facts mapping', () => {
  it('the real answer for 5900259128546 (fields as returned on 2026-11-23)', () => {
    const p = mapOff('5900259128546', { code: '5900259128546', status: 1, product: { brands: "Lay's", product_name: 'Oven Baked Chanterelles in a cream sauce flavoured', quantity: '', serving_size: '1 portion (30 g)', nutriments: { 'energy-kcal_100g': 441, proteins_100g: 5.7, fat_100g: 14, carbohydrates_100g: 73.8, fiber_100g: 4.8 } } })!;
    expect(p.name).toBe('Oven Baked Chanterelles in a cream sauce flavoured');
    expect(p.brand).toBe("Lay's");
    expect(p.per100).toEqual({ kcal: 441, p: 5.7, f: 14, c: 73.8, fiber: 4.8 });
    expect(p.serving).toBe(30);
    expect(p.pack).toBeUndefined();
    expect(p.missing).toEqual([]);
  });
  it('kJ only is converted, missing values are listed', () => {
    // 1000 kJ / 4.184 = 239.0 kcal
    const p = mapOff('1', { status: 1, product: { product_name_pl: 'Ser', quantity: '250 g', nutriments: { 'energy-kj_100g': 1000, proteins_100g: 20 } } })!;
    expect(p.per100).toEqual({ kcal: 239, p: 20, f: 0, c: 0 });
    expect(p.missing).toEqual(['f', 'c']);
    expect(p.pack).toBe(250);
  });
  it('status 0 is "not found"', () => { expect(mapOff('1', { status: 0, status_verbose: 'product not found' })).toBeNull(); });
  it('grams from labels', () => { expect([gramsOf('1 portion (30 g)'), gramsOf('1,5 kg'), gramsOf('330 ml'), gramsOf('x')]).toEqual([30, 1500, 330, undefined]); });
});

describe('lookup', () => {
  const answer = (status: number, body: unknown): Fetcher => async () => ({ ok: status < 400, status, json: async () => body });
  it('found, not found, server trouble, no network', async () => {
    expect((await lookupEan('1', answer(200, { status: 1, product: { product_name: 'A', nutriments: { 'energy-kcal_100g': 100 } } }))).kind).toBe('found');
    expect((await lookupEan('1', answer(200, { status: 0 }))).kind).toBe('notFound');
    expect((await lookupEan('1', answer(404, {}))).kind).toBe('notFound');
    expect((await lookupEan('1', answer(503, {}))).kind).toBe('offline');
    expect((await lookupEan('1', async () => { throw new TypeError('Failed to fetch'); })).kind).toBe('offline');
  });
  it('sends only the barcode', async () => {
    let seen = ''; await lookupEan('5900259128546', async (u) => { seen = u; return { ok: true, status: 200, json: async () => ({ status: 0 }) }; });
    expect(seen.startsWith('https://world.openfoodfacts.org/api/v2/product/5900259128546.json?fields=')).toBe(true);
  });
});
