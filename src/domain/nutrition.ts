/* Pure nutrition logic: no DOM, no storage. Every function here has unit tests with reference values worked out by hand. */

export interface Per100 { kcal: number; p: number; f: number; c: number; fiber?: number }
export type Source = 'off' | 'user' | 'recipe';
export interface Product {
  id: string;
  name: string;
  brand?: string;
  ean?: string;
  per100: Per100;
  /** a typical portion in grams (from the label or Open Food Facts) */
  serving?: number;
  /** grams in the whole pack */
  pack?: number;
  source: Source;
  /** the person changed values that came from Open Food Facts */
  edited?: boolean;
  /** shown once after a scan: "compare with the label" until confirmed */
  checked?: boolean;
  fav?: boolean;
  lastGrams?: number;
  createdAt: number; updatedAt: number;
  deletedAt?: number;
}
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];
/** A diary line. It keeps the values of the day it was written, so a later change to the product does not rewrite history. */
export interface Entry { id: string; date: string; meal: Meal; productId: string; name: string; grams: number; per100: Per100; at: number }
export interface Ingredient { productId: string; name: string; grams: number; per100: Per100 }
export interface Recipe { id: string; name: string; items: Ingredient[]; /** weight after cooking; empty = the sum of the raw ingredients */ cooked?: number; servings?: number; createdAt: number; updatedAt: number; deletedAt?: number }
export interface Weight { date: string; kg: number }

export type Sex = 'f' | 'm';
export type Goal = 'cut' | 'keep' | 'bulk';
export interface Profile { sex: Sex; birthYear: number; heightCm: number; weightKg: number; activity: 1 | 2 | 3 | 4 | 5; goal: Goal; proteinPerKg: number }
export interface Targets { kcal: number; p: number; f: number; c: number }
export interface Overrides { kcal?: number; p?: number; f?: number; c?: number }

export const r1 = (x: number): number => Math.round(x * 10) / 10;

/** Macros for a number of grams of something with values per 100 g. */
export function forGrams(per: Per100, grams: number): Per100 {
  const k = Math.max(0, grams) / 100;
  const out: Per100 = { kcal: Math.round(per.kcal * k), p: r1(per.p * k), f: r1(per.f * k), c: r1(per.c * k) };
  if (per.fiber != null) out.fiber = r1(per.fiber * k);
  return out;
}
export function sum(xs: Per100[]): Per100 {
  return xs.reduce<Per100>((a, x) => ({ kcal: a.kcal + x.kcal, p: r1(a.p + x.p), f: r1(a.f + x.f), c: r1(a.c + x.c) }), { kcal: 0, p: 0, f: 0, c: 0 });
}
export const entryMacros = (e: Pick<Entry, 'per100' | 'grams'>): Per100 => forGrams(e.per100, e.grams);
export const dayTotals = (entries: Entry[]): Per100 => sum(entries.map(entryMacros));

/** Energy from the macros (EU labels: protein and carbohydrates 4, fat 9, fibre 2 kcal per g; carbohydrates exclude fibre). Used only to check a label, never instead of it. */
export function kcalFromMacros(per: Per100): number { return Math.round(per.p * 4 + per.f * 9 + per.c * 4 + (per.fiber ?? 0) * 2); }
/** How far the label energy is from the energy of its macros, as a fraction of the label. */
export function kcalGap(per: Per100): number { if (!per.kcal) return 0; return Math.abs(per.kcal - kcalFromMacros(per)) / per.kcal; }
/** True when the values look wrongly typed (more than 15 % apart, or more than 100 g of nutrients in 100 g). */
export function looksWrong(per: Per100): boolean {
  if (per.p + per.f + per.c > 100.5) return true;
  if (per.kcal > 900 || per.kcal < 0) return true;
  return per.kcal >= 20 && kcalGap(per) > 0.15;
}

/* ---- targets: Mifflin-St Jeor, an activity factor, the goal, protein per kg, fat at least 0.8 g per kg, carbohydrates the rest ---- */
export const ACTIVITY = { 1: 1.2, 2: 1.375, 3: 1.55, 4: 1.725, 5: 1.9 } as const;
export const GOAL_FACTOR: Record<Goal, number> = { cut: 0.8, keep: 1, bulk: 1.1 };
export function bmr(p: Profile, year: number): number {
  const age = year - p.birthYear;
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * age + (p.sex === 'm' ? 5 : -161);
}
export function targets(p: Profile, year: number, o: Overrides = {}): Targets {
  const tdee = bmr(p, year) * ACTIVITY[p.activity];
  const kcal = o.kcal ?? Math.round((tdee * GOAL_FACTOR[p.goal]) / 10) * 10;
  const prot = o.p ?? Math.round(p.weightKg * p.proteinPerKg);
  const fat = o.f ?? Math.round(Math.max(p.weightKg * 0.8, (kcal * 0.25) / 9));
  const carb = o.c ?? Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
  return { kcal, p: prot, f: fat, c: carb };
}

/* ---- recipes: the sum of the ingredients divided by the cooked weight ---- */
export function recipeWeight(r: Pick<Recipe, 'items' | 'cooked'>): number { return r.cooked && r.cooked > 0 ? r.cooked : r.items.reduce((a, i) => a + i.grams, 0); }
export function recipePer100(r: Pick<Recipe, 'items' | 'cooked'>): Per100 {
  const w = recipeWeight(r); if (!w) return { kcal: 0, p: 0, f: 0, c: 0 };
  const t = sum(r.items.map(i => forGrams(i.per100, i.grams)));
  return { kcal: Math.round((t.kcal / w) * 100), p: r1((t.p / w) * 100), f: r1((t.f / w) * 100), c: r1((t.c / w) * 100) };
}

/* ---- body weight: the 7-day average smooths out water ---- */
const dayNum = (d: string): number => Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5);
/** Average of the weights in the 7 days ending on `date` (inclusive). null when there is none. */
export function avg7(ws: Weight[], date: string): number | null {
  const end = dayNum(date); const xs = ws.filter(w => { const n = dayNum(w.date); return n <= end && n > end - 7; });
  return xs.length ? r1(xs.reduce((a, w) => a + w.kg, 0) / xs.length) : null;
}
/** Change of the 7-day average against the week before. */
export function weeklyChange(ws: Weight[], date: string): number | null {
  const now = avg7(ws, date); const prev = avg7(ws, addDays(date, -7));
  return now == null || prev == null ? null : r1(now - prev);
}
export function addDays(d: string, n: number): string { const t = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) + n * 864e5); return t.toISOString().slice(0, 10); }
/** Average energy of the days with at least one entry, over the `n` days ending on `date`. */
export function avgKcal(entries: Entry[], date: string, n = 7): { avg: number; days: number } {
  const days = new Map<string, number>();
  for (const e of entries) { const k = dayNum(e.date), end = dayNum(date); if (k <= end && k > end - n) days.set(e.date, (days.get(e.date) ?? 0) + entryMacros(e).kcal); }
  const v = [...days.values()]; return { avg: v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0, days: v.length };
}

/* ---- barcodes ---- */
/** EAN-13, EAN-8, UPC-A (12) and UPC-E as 8 digits: digits only and a valid check digit. */
export function validEan(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return false;
  const d = code.split('').map(Number); const check = d.pop()!;
  const s = d.reverse().reduce((a, x, i) => a + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (s % 10)) % 10 === check;
}
export const cleanEan = (s: string): string => s.replace(/\D/g, '');
